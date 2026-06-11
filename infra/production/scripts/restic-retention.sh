#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=backup-run-lib.sh
source "${script_dir}/backup-run-lib.sh"
# shellcheck source=validate-backup-env.sh
source "${script_dir}/validate-backup-env.sh"

mode="${1:-forget}"

if [[ "$mode" == "forget" ]]; then
  kind="restic_forget"
  command=(restic forget --keep-daily 7 --keep-weekly 4 --keep-monthly 12)
elif [[ "$mode" == "prune" ]]; then
  kind="restic_prune"
  command=(restic prune)
else
  echo "Retention mode must be forget or prune." >&2
  exit 1
fi

run_id="$(backup_run_start "$kind")"
backup_run_guard "$run_id" "Restic ${mode} exited before completion"

if "${command[@]}"; then
  backup_run_succeed "$run_id"
else
  backup_run_fail "$run_id" "Restic ${mode} failed"
  exit 1
fi
