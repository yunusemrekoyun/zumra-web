#!/usr/bin/env bash
set -euo pipefail

backup_type="${1:-diff}"
root="/srv/zumra"
compose="${root}/current/infra/production/scripts/compose.sh"

if [[ "$backup_type" != "full" && "$backup_type" != "diff" ]]; then
  echo "Backup type must be full or diff." >&2
  exit 1
fi

if [[ "$backup_type" == "full" ]]; then
  kind="physical_full"
else
  kind="physical_differential"
fi

run_id="$("$compose" exec -T backup /opt/zumra/scripts/backup-run-command.sh start "$kind")"
run_completed=false

mark_failed_on_exit() {
  local exit_code="$?"

  if [[ "$exit_code" -ne 0 && "$run_completed" != "true" ]]; then
    "$compose" exec -T backup /opt/zumra/scripts/backup-run-command.sh \
      fail "$run_id" "pgBackRest ${backup_type} exited before completion" ||
      true
  fi
}
trap mark_failed_on_exit EXIT

if "$compose" exec -T postgres pgbackrest --stanza=zumra --type="$backup_type" backup; then
  info="$("$compose" exec -T postgres pgbackrest --stanza=zumra --output=json info)"
  snapshot_id="$(jq -r '.[0].backup[-1].label // empty' <<<"$info")"
  size_bytes="$(jq -r '.[0].backup[-1].info.repository.size // 0' <<<"$info")"
  "$compose" exec -T backup /opt/zumra/scripts/backup-run-command.sh \
    succeed "$run_id" "${size_bytes:-0}" "$snapshot_id"
  run_completed=true
else
  "$compose" exec -T backup /opt/zumra/scripts/backup-run-command.sh fail "$run_id" "pgBackRest ${backup_type} failed"
  run_completed=true
  exit 1
fi
