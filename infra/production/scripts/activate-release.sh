#!/usr/bin/env bash
set -euo pipefail

release_id="${1:?release id is required}"
root="/srv/zumra"
release_dir="${root}/releases/${release_id}"
shared="${root}/shared"
compose_file="${release_dir}/infra/production/compose.yaml"
deploy_env="${shared}/deploy.env"
infra_env="${shared}/infra.env"
app_env="${shared}/app.env"
worker_env="${shared}/worker.env"
migration_env="${shared}/migration.env"
app_image="zumra-app:${release_id}"
worker_image="zumra-worker:${release_id}"
media_image="zumra-media-processor:${release_id}"

mkdir -p \
  "${root}/backups/predeploy" \
  "${root}/data/media" \
  "${root}/runtime/media-jobs" \
  "${shared}/nginx"
chmod 2770 "${root}/data/media" "${root}/runtime/media-jobs"

for secret_file in "$infra_env" "$app_env" "$worker_env" "${shared}/backup.env" "$migration_env"; do
  if [[ ! -f "$secret_file" ]]; then
    echo "Missing production configuration: ${secret_file}" >&2
    exit 1
  fi
  chmod 600 "$secret_file"
done

ZUMRA_ROOT="$root" "${release_dir}/infra/production/scripts/preflight.sh"

set -a
source "$infra_env"
set +a

active_slot="$(cat "${shared}/active-slot" 2>/dev/null || echo blue)"
if [[ "$active_slot" == "blue" ]]; then
  inactive_slot="green"
else
  inactive_slot="blue"
fi

docker build -t "$app_image" -f "${release_dir}/Dockerfile" "$release_dir"
docker build -t "$worker_image" -f "${release_dir}/Dockerfile.worker" "$release_dir"
docker build -t "$media_image" -f "${release_dir}/Dockerfile.media-processor" "$release_dir"

set_deploy_value() {
  local key="$1"
  local value="$2"

  if grep -q "^${key}=" "$deploy_env" 2>/dev/null; then
    sed -i "s|^${key}=.*|${key}=${value}|" "$deploy_env"
  else
    printf '%s=%s\n' "$key" "$value" >> "$deploy_env"
  fi
}

get_deploy_value() {
  local key="$1"
  sed -n "s/^${key}=//p" "$deploy_env" 2>/dev/null | tail -n 1
}

ensure_deploy_value() {
  local key="$1"
  local value="$2"

  if [[ -z "$(get_deploy_value "$key")" ]]; then
    set_deploy_value "$key" "$value"
  fi
}

if [[ ! -f "$deploy_env" ]]; then
  cat > "$deploy_env" <<EOF
APP_BLUE_IMAGE=$app_image
APP_GREEN_IMAGE=$app_image
WORKER_BLUE_IMAGE=$worker_image
WORKER_GREEN_IMAGE=$worker_image
MEDIA_PROCESSOR_BLUE_IMAGE=$media_image
MEDIA_PROCESSOR_GREEN_IMAGE=$media_image
BLUE_RELEASE_ID=$release_id
GREEN_RELEASE_ID=$release_id
EOF
  active_slot="blue"
  inactive_slot="green"
else
  legacy_worker="$(sed -n 's/^WORKER_IMAGE=//p' "$deploy_env" | tail -n 1)"
  legacy_media="$(sed -n 's/^MEDIA_PROCESSOR_IMAGE=//p' "$deploy_env" | tail -n 1)"
  active_release="$(basename "$(readlink -f "${root}/current" 2>/dev/null || echo "$release_id")")"

  ensure_deploy_value "APP_${active_slot^^}_IMAGE" "zumra-app:${active_release}"
  ensure_deploy_value \
    "WORKER_${active_slot^^}_IMAGE" \
    "${legacy_worker:-zumra-worker:${active_release}}"
  ensure_deploy_value \
    "MEDIA_PROCESSOR_${active_slot^^}_IMAGE" \
    "${legacy_media:-zumra-media-processor:${active_release}}"
  ensure_deploy_value "${active_slot^^}_RELEASE_ID" "$active_release"
  set_deploy_value "APP_${inactive_slot^^}_IMAGE" "$app_image"
  set_deploy_value "WORKER_${inactive_slot^^}_IMAGE" "$worker_image"
  set_deploy_value "MEDIA_PROCESSOR_${inactive_slot^^}_IMAGE" "$media_image"
  set_deploy_value "${inactive_slot^^}_RELEASE_ID" "$release_id"
fi
chmod 600 "$deploy_env"

compose() {
  docker compose \
    --env-file "$infra_env" \
    --env-file "$deploy_env" \
    -f "$compose_file" "$@"
}

compose up -d postgres redis clamav backup uptime_kuma
compose exec -T postgres pgbackrest --stanza=zumra stanza-create

backup_file="${root}/backups/predeploy/${release_id}.dump"
if ! compose exec -T postgres pg_dump \
  -U "$POSTGRES_USER" \
  -d "$POSTGRES_DB" \
  -Fc > "$backup_file"; then
  rm -f "$backup_file"
  echo "Pre-deploy database backup failed; release activation aborted." >&2
  exit 1
fi

docker run --rm \
  --network zumra-production_backend \
  --env-file "$migration_env" \
  "$worker_image" \
  node dist/migrate.cjs

compose up -d "worker_${inactive_slot}" "media_processor_${inactive_slot}"
compose up -d "app_${inactive_slot}"

readiness_token="$(sed -n 's/^READINESS_TOKEN=//p' "$app_env" | tail -n 1)"
if [[ -z "$readiness_token" ]]; then
  echo "READINESS_TOKEN is missing from app.env." >&2
  exit 1
fi

ready=false
for _ in $(seq 1 30); do
  media_container="$(compose ps -q "media_processor_${inactive_slot}")"
  media_health="$(
    docker inspect \
      --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}missing{{end}}' \
      "$media_container" 2>/dev/null || true
  )"

  if [[ "$media_health" == "healthy" ]] && docker run --rm \
    --network zumra-production_edge \
    "$app_image" \
    node -e "fetch('http://app_${inactive_slot}:3000/api/health/ready',{headers:{authorization:'Bearer ${readiness_token}'}}).then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"; then
    ready=true
    break
  fi
  sleep 3
done

if [[ "$ready" != "true" ]]; then
  compose stop "worker_${inactive_slot}" "media_processor_${inactive_slot}" "app_${inactive_slot}"
  echo "Release readiness failed; traffic was not changed." >&2
  exit 1
fi

previous_upstream="$(
  cat "${shared}/nginx/upstream.conf" 2>/dev/null ||
    printf 'server app_%s:3000;\n' "$active_slot"
)"
printf 'server app_%s:3000;\n' "$inactive_slot" > "${shared}/nginx/upstream.conf.new"
mv "${shared}/nginx/upstream.conf.new" "${shared}/nginx/upstream.conf"

if ! compose up -d nginx ||
  ! compose exec -T nginx nginx -t ||
  ! compose exec -T nginx nginx -s reload; then
  printf '%s\n' "$previous_upstream" > "${shared}/nginx/upstream.conf.restore"
  mv "${shared}/nginx/upstream.conf.restore" "${shared}/nginx/upstream.conf"
  compose up -d nginx || true
  compose exec -T nginx nginx -t &&
    compose exec -T nginx nginx -s reload || true
  compose stop \
    "worker_${inactive_slot}" \
    "media_processor_${inactive_slot}" \
    "app_${inactive_slot}" || true
  echo "Nginx traffic switch failed; the previous upstream was restored." >&2
  exit 1
fi

compose stop "worker_${active_slot}" "media_processor_${active_slot}" || true
printf '%s\n' "$inactive_slot" > "${shared}/active-slot"
ln -sfn "$release_dir" "${root}/current"

echo "Activated release ${release_id} on ${inactive_slot}."
