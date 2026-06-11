#!/usr/bin/env bash

: "${BACKUP_DATABASE_URL:?BACKUP_DATABASE_URL is required}"

backup_run_guard_id=""
backup_run_guard_summary="Backup operation exited before completion"

backup_run_guard() {
  backup_run_guard_id="${1:?backup run id is required}"
  backup_run_guard_summary="${2:-$backup_run_guard_summary}"
  trap 'backup_run_guard_on_exit $?' EXIT
}

backup_run_guard_complete() {
  backup_run_guard_id=""
}

backup_run_guard_on_exit() {
  local exit_code="$1"

  if [[ "$exit_code" -ne 0 && -n "$backup_run_guard_id" ]]; then
    backup_run_fail "$backup_run_guard_id" "$backup_run_guard_summary" ||
      echo "Could not mark backup run ${backup_run_guard_id} as failed." >&2
  fi
}

backup_run_start() {
  local kind="${1:?backup kind is required}"
  psql "$BACKUP_DATABASE_URL" -v ON_ERROR_STOP=1 -c \
    "update backup_runs
     set status='failed',
         completed_at=now(),
         error_summary='Operation exceeded the 24 hour stale threshold'
     where status='running'
       and started_at < now() - interval '24 hours'" >/dev/null
  psql "$BACKUP_DATABASE_URL" -Atqc \
    "insert into backup_runs (id, kind, status, started_at, metadata)
     values (gen_random_uuid(), '${kind}', 'running', now(), '{}'::jsonb)
     returning id"
}

backup_run_succeed() {
  local run_id="${1:?run id is required}"
  local size_bytes="${2:-0}"
  local snapshot_id="${3:-}"

  psql "$BACKUP_DATABASE_URL" -v ON_ERROR_STOP=1 -c \
    "update backup_runs
     set status='succeeded',
         completed_at=now(),
         size_bytes=${size_bytes},
         snapshot_id=nullif('${snapshot_id}', '')
     where id='${run_id}'"
  backup_run_guard_complete
}

backup_run_fail() {
  local run_id="${1:?run id is required}"
  local summary="${2:-backup operation failed}"
  summary="${summary//\'/}"

  psql "$BACKUP_DATABASE_URL" -v ON_ERROR_STOP=1 -c \
    "update backup_runs
     set status='failed',
         completed_at=now(),
         error_summary='${summary:0:500}'
     where id='${run_id}'"
  backup_run_guard_complete
}
