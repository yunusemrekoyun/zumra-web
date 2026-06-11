#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=backup-run-lib.sh
source "${script_dir}/backup-run-lib.sh"
# shellcheck source=validate-backup-env.sh
source "${script_dir}/validate-backup-env.sh"

run_id="$(backup_run_start wal)"
backup_run_guard "$run_id" "Restic WAL sync exited before completion"
output="$(mktemp)"

cleanup() {
  local exit_code="$?"
  rm -f "$output"
  backup_run_guard_on_exit "$exit_code"
}
trap cleanup EXIT

if restic backup \
  /data/pgbackrest \
  /data/pgbackrest-spool \
  --tag zumra-wal \
  --json > "$output"; then
  snapshot_id="$(jq -r 'select(.message_type == "summary") | .snapshot_id // empty' "$output" | tail -n 1)"
  size="$(jq -r 'select(.message_type == "summary") | .total_bytes_processed // 0' "$output" | tail -n 1)"

  if [[ -z "$snapshot_id" ]]; then
    backup_run_fail "$run_id" "Restic WAL sync did not return a snapshot ID"
    exit 1
  fi

  backup_run_succeed "$run_id" "${size:-0}" "$snapshot_id"
else
  backup_run_fail "$run_id" "Restic WAL sync failed"
  exit 1
fi
