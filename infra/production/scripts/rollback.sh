#!/usr/bin/env bash
set -euo pipefail

root="/srv/zumra"
shared="${root}/shared"
release_dir="$(readlink -f "${root}/current")"
compose_file="${release_dir}/infra/production/compose.yaml"
active_slot="$(cat "${shared}/active-slot")"

if [[ "$active_slot" == "blue" ]]; then
  target_slot="green"
else
  target_slot="blue"
fi

compose() {
  docker compose \
    --env-file "${shared}/infra.env" \
    --env-file "${shared}/deploy.env" \
    -f "$compose_file" "$@"
}

compose up -d "worker_${target_slot}" "media_processor_${target_slot}"
compose up -d "app_${target_slot}"

readiness_token="$(sed -n 's/^READINESS_TOKEN=//p' "${shared}/app.env" | tail -n 1)"
ready=false
for _ in $(seq 1 30); do
  media_container="$(compose ps -q "media_processor_${target_slot}")"
  media_health="$(
    docker inspect \
      --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}missing{{end}}' \
      "$media_container" 2>/dev/null || true
  )"

  if [[ "$media_health" == "healthy" ]] &&
    compose exec -T "app_${target_slot}" \
    node -e "fetch('http://127.0.0.1:3000/api/health/ready',{headers:{authorization:'Bearer ${readiness_token}'}}).then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"; then
    ready=true
    break
  fi
  sleep 3
done

if [[ "$ready" != "true" ]]; then
  compose stop \
    "worker_${target_slot}" \
    "media_processor_${target_slot}" \
    "app_${target_slot}"
  echo "Rollback target readiness failed; traffic was not changed." >&2
  exit 1
fi

previous_upstream="$(
  cat "${shared}/nginx/upstream.conf" 2>/dev/null ||
    printf 'server app_%s:3000;\n' "$active_slot"
)"
printf 'server app_%s:3000;\n' "$target_slot" > "${shared}/nginx/upstream.conf.new"
mv "${shared}/nginx/upstream.conf.new" "${shared}/nginx/upstream.conf"

if ! compose exec -T nginx nginx -t ||
  ! compose exec -T nginx nginx -s reload; then
  printf '%s\n' "$previous_upstream" > "${shared}/nginx/upstream.conf.restore"
  mv "${shared}/nginx/upstream.conf.restore" "${shared}/nginx/upstream.conf"
  compose exec -T nginx nginx -t &&
    compose exec -T nginx nginx -s reload || true
  compose stop \
    "worker_${target_slot}" \
    "media_processor_${target_slot}" \
    "app_${target_slot}" || true
  echo "Rollback Nginx switch failed; the active upstream was restored." >&2
  exit 1
fi

compose stop "worker_${active_slot}" "media_processor_${active_slot}" || true

printf '%s\n' "$target_slot" > "${shared}/active-slot"
target_release_variable="${target_slot^^}_RELEASE_ID"
target_release="$(sed -n "s/^${target_release_variable}=//p" "${shared}/deploy.env" | tail -n 1)"
if [[ -n "$target_release" && -d "${root}/releases/${target_release}" ]]; then
  ln -sfn "${root}/releases/${target_release}" "${root}/current"
fi
echo "Traffic rolled back to ${target_slot}."
