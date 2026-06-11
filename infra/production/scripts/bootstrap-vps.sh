#!/usr/bin/env bash
set -euo pipefail

if [[ "${EUID}" -ne 0 ]]; then
  echo "Run bootstrap-vps.sh as root." >&2
  exit 1
fi

root="${ZUMRA_ROOT:-/srv/zumra}"
deploy_user="${ZUMRA_DEPLOY_USER:-deploy}"

getent group zumra-media >/dev/null || groupadd --system --gid 2000 zumra-media

container_identity() {
  local image="$1"
  local user="$2"
  docker run --rm --entrypoint sh "$image" -c "printf '%s:%s' \"\$(id -u '$user')\" \"\$(id -g '$user')\""
}

postgres_identity="$(container_identity postgres:17.10-trixie postgres)"
redis_identity="$(container_identity redis:8.8.0-alpine redis)"
clamav_identity="$(container_identity clamav/clamav-debian:1.4.3 clamav)"
uptime_identity="$(container_identity louislam/uptime-kuma:2.4.0 node)"

install -d -m 0750 -o "$deploy_user" -g "$deploy_user" \
  "${root}/releases" \
  "${root}/shared" \
  "${root}/shared/nginx" \
  "${root}/shared/tls"

install -d -m 2770 -o "$deploy_user" -g zumra-media \
  "${root}/data/media" \
  "${root}/runtime/media-jobs"

install -d -m 0750 -o "$deploy_user" -g "$deploy_user" \
  "${root}/backups" \
  "${root}/data/restic-cache" \
  "${root}/data/rclone" \
  "${root}/restore-drills"

install -d -m 0700 -o "${postgres_identity%:*}" -g "${postgres_identity#*:}" \
  "${root}/data/postgres" \
  "${root}/data/pgbackrest" \
  "${root}/runtime/pgbackrest-spool"
install -d -m 0700 -o "${redis_identity%:*}" -g "${redis_identity#*:}" \
  "${root}/data/redis"
install -d -m 0750 -o "${clamav_identity%:*}" -g "${clamav_identity#*:}" \
  "${root}/data/clamav"
install -d -m 0750 -o "${uptime_identity%:*}" -g "${uptime_identity#*:}" \
  "${root}/data/uptime-kuma"

for secret_name in infra app worker backup migration; do
  secret_path="${root}/shared/${secret_name}.env"

  if [[ ! -e "$secret_path" ]]; then
    install -m 0600 -o "$deploy_user" -g "$deploy_user" /dev/null \
      "$secret_path"
  else
    chown "$deploy_user:$deploy_user" "$secret_path"
    chmod 0600 "$secret_path"
  fi
done

upstream_path="${root}/shared/nginx/upstream.conf"

if [[ ! -e "$upstream_path" ]]; then
  printf 'server app_blue:3000;\n' > "$upstream_path"
fi

chown "$deploy_user:$deploy_user" "${root}/shared/nginx/upstream.conf"
chmod 0640 "${root}/shared/nginx/upstream.conf"

echo "VPS directories created. Fill the five secret env files before deployment."
