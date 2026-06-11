#!/usr/bin/env bash
set -euo pipefail

root="${ZUMRA_ROOT:-/srv/zumra}"
required_commands=(docker curl jq rsync)
required_files=(
  "${root}/shared/infra.env"
  "${root}/shared/app.env"
  "${root}/shared/worker.env"
  "${root}/shared/backup.env"
  "${root}/shared/migration.env"
  "${root}/shared/tls/origin.pem"
  "${root}/shared/tls/origin.key"
  "${root}/data/rclone/rclone.conf"
)

for command_name in "${required_commands[@]}"; do
  command -v "$command_name" >/dev/null 2>&1 || {
    echo "Missing command: ${command_name}" >&2
    exit 1
  }
done

docker compose version >/dev/null

for file_path in "${required_files[@]}"; do
  [[ -f "$file_path" ]] || {
    echo "Missing configuration: ${file_path}" >&2
    exit 1
  }

  case "$file_path" in
    *.env|*.key|*/rclone.conf)
      mode="$(stat -c '%a' "$file_path")"
      [[ "$mode" == "600" ]] || {
        echo "${file_path} must have mode 600; current mode is ${mode}." >&2
        exit 1
      }
      ;;
  esac
done

require_key() {
  local file_path="$1"
  local key="$2"

  grep -Eq "^${key}=.+" "$file_path" || {
    echo "${file_path} is missing ${key}." >&2
    exit 1
  }
}

require_value() {
  local file_path="$1"
  local key="$2"
  local expected="$3"
  local actual

  actual="$(sed -n "s/^${key}=//p" "$file_path" | tail -n 1)"
  [[ "$actual" == "$expected" ]] || {
    echo "${file_path} must set ${key}=${expected}." >&2
    exit 1
  }
}

require_pattern() {
  local file_path="$1"
  local pattern="$2"
  local description="$3"

  grep -Eq "$pattern" "$file_path" || {
    echo "${file_path} must contain ${description}." >&2
    exit 1
  }
}

for key in \
  POSTGRES_DB POSTGRES_USER POSTGRES_PASSWORD \
  APP_DB_USER APP_DB_PASSWORD \
  BACKUP_DB_USER BACKUP_DB_PASSWORD \
  REDIS_ADMIN_PASSWORD REDIS_PASSWORD; do
  require_key "${root}/shared/infra.env" "$key"
done

require_value "${root}/shared/infra.env" POSTGRES_USER zumra_migrator
require_value "${root}/shared/infra.env" APP_DB_USER zumra_app
require_value "${root}/shared/infra.env" BACKUP_DB_USER zumra_backup

for key in \
  APP_URL BETTER_AUTH_URL BETTER_AUTH_SECRET AUTH_ENFORCEMENT_ENABLED \
  DEVICE_COOKIE_SECRET READINESS_TOKEN \
  OUTBOX_ENCRYPTION_SECRET \
  DATABASE_URL REDIS_URL; do
  require_key "${root}/shared/app.env" "$key"
done

google_client_id="$(sed -n 's/^GOOGLE_CLIENT_ID=//p' "${root}/shared/app.env" | tail -n 1)"
google_client_secret="$(sed -n 's/^GOOGLE_CLIENT_SECRET=//p' "${root}/shared/app.env" | tail -n 1)"
if {
  [[ -n "$google_client_id" ]] && [[ -z "$google_client_secret" ]]
} || {
  [[ -z "$google_client_id" ]] && [[ -n "$google_client_secret" ]]
}; then
  echo \
    "${root}/shared/app.env must configure GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET together." \
    >&2
  exit 1
fi

require_pattern \
  "${root}/shared/app.env" \
  '^DATABASE_URL=postgresql://zumra_app:' \
  'DATABASE_URL for the zumra_app role'
require_pattern \
  "${root}/shared/app.env" \
  '^REDIS_URL=redis://zumra:' \
  'REDIS_URL for the scoped zumra user'

for key in \
  OUTBOX_ENCRYPTION_SECRET DATABASE_URL REDIS_URL \
  SMTP_HOST SMTP_PORT SMTP_SECURE SMTP_FROM; do
  require_key "${root}/shared/worker.env" "$key"
done

require_pattern \
  "${root}/shared/worker.env" \
  '^DATABASE_URL=postgresql://zumra_app:' \
  'DATABASE_URL for the zumra_app role'
require_pattern \
  "${root}/shared/worker.env" \
  '^REDIS_URL=redis://zumra:' \
  'REDIS_URL for the scoped zumra user'

for key in BACKUP_DATABASE_URL RESTIC_REPOSITORY RESTIC_PASSWORD; do
  require_key "${root}/shared/backup.env" "$key"
done

require_pattern \
  "${root}/shared/backup.env" \
  '^BACKUP_DATABASE_URL=postgresql://zumra_backup:' \
  'BACKUP_DATABASE_URL for the zumra_backup role'

require_key "${root}/shared/migration.env" MIGRATION_DATABASE_URL
require_pattern \
  "${root}/shared/migration.env" \
  '^MIGRATION_DATABASE_URL=postgresql://zumra_migrator:' \
  'MIGRATION_DATABASE_URL for the zumra_migrator role'

for directory in \
  "${root}/backups" \
  "${root}/data/clamav" \
  "${root}/data/media" \
  "${root}/data/pgbackrest" \
  "${root}/data/postgres" \
  "${root}/data/redis" \
  "${root}/data/restic-cache" \
  "${root}/data/rclone" \
  "${root}/data/uptime-kuma" \
  "${root}/runtime/media-jobs" \
  "${root}/runtime/pgbackrest-spool"; do
  [[ -d "$directory" ]] || {
    echo "Missing runtime directory: ${directory}" >&2
    exit 1
  }
done

for media_directory in \
  "${root}/data/media" \
  "${root}/runtime/media-jobs"; do
  mode="$(stat -c '%a' "$media_directory")"
  group="$(stat -c '%G' "$media_directory")"

  [[ "$mode" == "2770" && "$group" == "zumra-media" ]] || {
    echo \
      "${media_directory} must be mode 2770 and group zumra-media; current is ${mode} ${group}." \
      >&2
    exit 1
  }
done

echo "Production preflight passed."
