#!/usr/bin/env bash
set -euo pipefail

root="/srv/zumra"
compose="${root}/current/infra/production/scripts/compose.sh"
drill_id="$(date -u +%Y%m%d%H%M%S)"
target="/backups/restore-drill/${drill_id}"
run_id="$("$compose" exec -T backup /opt/zumra/scripts/backup-run-command.sh start restore_drill)"
run_completed=false

mark_failed_on_exit() {
  local exit_code="$?"

  if [[ "$exit_code" -ne 0 && "$run_completed" != "true" ]]; then
    "$compose" exec -T backup /opt/zumra/scripts/backup-run-command.sh \
      fail "$run_id" "Restic restore drill exited before completion" ||
      true
  fi
}
trap mark_failed_on_exit EXIT

if "$compose" exec -T backup sh -ec "
  . /opt/zumra/scripts/validate-backup-env.sh
  mkdir -p '${target}'
  restic restore latest --target '${target}' --include '/backups/logical'
  find '${target}' -type f -name '*.dump' -print -quit | grep -q .
"; then
  "$compose" exec -T backup /opt/zumra/scripts/backup-run-command.sh succeed "$run_id"
  run_completed=true
  echo "Restic restore sample created under ${root}/backups/restore-drill/${drill_id}."
else
  "$compose" exec -T backup /opt/zumra/scripts/backup-run-command.sh fail "$run_id" "Restic restore drill failed"
  run_completed=true
  exit 1
fi
