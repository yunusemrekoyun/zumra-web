#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=backup-run-lib.sh
source "${script_dir}/backup-run-lib.sh"
# shellcheck source=validate-backup-env.sh
source "${script_dir}/validate-backup-env.sh"

run_id="$(backup_run_start restic_check)"
backup_run_guard "$run_id" "Restic repository check exited before completion"

if restic check --read-data-subset=5%; then
  backup_run_succeed "$run_id"
else
  backup_run_fail "$run_id" "Restic repository check failed"
  exit 1
fi
