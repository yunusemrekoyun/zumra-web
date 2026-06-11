#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=backup-run-lib.sh
source "${script_dir}/backup-run-lib.sh"

timestamp="$(date -u +%Y%m%dT%H%M%SZ)"
directory="/backups/logical"
dump="${directory}/zumra-${timestamp}.dump"
mkdir -p "$directory"

run_id="$(backup_run_start logical)"
backup_run_guard "$run_id" "Logical backup exited before completion"

if pg_dump "$BACKUP_DATABASE_URL" --format=custom --compress=zstd:6 --file="$dump"; then
  size="$(stat -c %s "$dump")"
  backup_run_succeed "$run_id" "$size"
else
  backup_run_fail "$run_id" "pg_dump failed"
  exit 1
fi
