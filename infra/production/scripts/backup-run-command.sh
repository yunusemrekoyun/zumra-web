#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=backup-run-lib.sh
source "${script_dir}/backup-run-lib.sh"

action="${1:?action is required}"

case "$action" in
  start)
    backup_run_start "${2:?backup kind is required}"
    ;;
  succeed)
    backup_run_succeed "${2:?run id is required}" "${3:-0}" "${4:-}"
    ;;
  fail)
    backup_run_fail "${2:?run id is required}" "${3:-backup operation failed}"
    ;;
  *)
    echo "Unknown backup run action: ${action}" >&2
    exit 1
    ;;
esac
