#!/usr/bin/env bash
set -euo pipefail

target="${1:?UTC recovery target is required, for example 2026-06-08 12:00:00+00}"
root="/srv/zumra"
compose="${root}/current/infra/production/scripts/compose.sh"
infra_env="${root}/shared/infra.env"
drill_id="$(date -u +%Y%m%d%H%M%S)"
drill_root="${root}/restore-drills/pitr-${drill_id}"
data_dir="${drill_root}/data"
spool_dir="${drill_root}/spool"
container="zumra-pitr-restore-${drill_id}"
image="zumra-postgres-drill:17.10"
run_id="$("$compose" exec -T backup /opt/zumra/scripts/backup-run-command.sh start restore_drill)"
run_completed=false

set -a
# shellcheck disable=SC1090
source "$infra_env"
set +a

cleanup() {
  local exit_code="$?"
  docker rm -f "$container" >/dev/null 2>&1 || true

  if [[ "$exit_code" -ne 0 && "$run_completed" != "true" ]]; then
    "$compose" exec -T backup /opt/zumra/scripts/backup-run-command.sh \
      fail "$run_id" "PITR restore drill exited before completion" ||
      true
  fi
}
trap cleanup EXIT

postgres_uid="$(docker run --rm --entrypoint sh postgres:17.10-trixie -c 'id -u postgres')"
postgres_gid="$(docker run --rm --entrypoint sh postgres:17.10-trixie -c 'id -g postgres')"
install -d -m 0700 -o "$postgres_uid" -g "$postgres_gid" "$data_dir" "$spool_dir"

if docker build \
  -t "$image" \
  -f "${root}/current/infra/production/postgres/Dockerfile" \
  "${root}/current" &&
  docker run --rm \
    --user postgres \
    -v "${data_dir}:/var/lib/postgresql/data" \
    -v "${root}/data/pgbackrest:/var/lib/pgbackrest:ro" \
    -v "${spool_dir}:/var/spool/pgbackrest" \
    -v "${root}/current/infra/production/pgbackrest/pgbackrest.conf:/etc/pgbackrest/pgbackrest.conf:ro" \
    "$image" \
    pgbackrest \
      --stanza=zumra \
      --type=time \
      --target="$target" \
      --target-action=promote \
      restore; then
  docker run -d \
    --name "$container" \
    --user postgres \
    -v "${data_dir}:/var/lib/postgresql/data" \
    "$image" \
    postgres -c archive_mode=off -c "archive_command=" >/dev/null

  for _ in $(seq 1 60); do
    docker exec "$container" pg_isready \
      -U "$POSTGRES_USER" \
      -d "$POSTGRES_DB" >/dev/null 2>&1 && break
    sleep 2
  done

  docker exec "$container" psql \
    -U "$POSTGRES_USER" \
    -d "$POSTGRES_DB" \
    -Atqc \
    "select pg_is_in_recovery(), now()" >/dev/null
  "$compose" exec -T backup /opt/zumra/scripts/backup-run-command.sh succeed "$run_id"
  run_completed=true
else
  "$compose" exec -T backup /opt/zumra/scripts/backup-run-command.sh fail "$run_id" "PITR restore drill failed"
  run_completed=true
  exit 1
fi

echo "PITR drill data retained at ${drill_root} for manual inspection."
