#!/usr/bin/env bash
set -euo pipefail

root="/srv/zumra"
compose="${root}/current/infra/production/scripts/compose.sh"
dump="${1:-$(find "${root}/backups/logical" -type f -name '*.dump' -print | sort | tail -n 1)}"
container="zumra-logical-restore-$(date -u +%Y%m%d%H%M%S)"
run_id="$("$compose" exec -T backup /opt/zumra/scripts/backup-run-command.sh start restore_drill)"
run_completed=false

cleanup() {
  local exit_code="$?"
  docker rm -f "$container" >/dev/null 2>&1 || true

  if [[ "$exit_code" -ne 0 && "$run_completed" != "true" ]]; then
    "$compose" exec -T backup /opt/zumra/scripts/backup-run-command.sh \
      fail "$run_id" "Logical restore drill exited before completion" ||
      true
  fi
}
trap cleanup EXIT

if [[ ! -f "$dump" ]]; then
  "$compose" exec -T backup /opt/zumra/scripts/backup-run-command.sh fail "$run_id" "Logical dump not found"
  exit 1
fi

if docker run -d --name "$container" \
  -e POSTGRES_PASSWORD=restore-drill-only \
  postgres:17.10-alpine >/dev/null; then
  for _ in $(seq 1 30); do
    docker exec "$container" pg_isready -U postgres >/dev/null 2>&1 && break
    sleep 1
  done

  docker cp "$dump" "${container}:/tmp/restore.dump"
  docker exec "$container" pg_restore \
    --clean \
    --if-exists \
    --no-owner \
    --username postgres \
    --dbname postgres \
    /tmp/restore.dump
  docker exec "$container" psql -U postgres -d postgres -Atqc \
    "select count(*) from information_schema.tables where table_schema='public'" |
    grep -Eq '^[1-9][0-9]*$'
  "$compose" exec -T backup /opt/zumra/scripts/backup-run-command.sh succeed "$run_id"
  run_completed=true
else
  "$compose" exec -T backup /opt/zumra/scripts/backup-run-command.sh fail "$run_id" "Logical restore drill failed"
  run_completed=true
  exit 1
fi
