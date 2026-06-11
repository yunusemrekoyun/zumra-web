#!/usr/bin/env bash

: "${BACKUP_DATABASE_URL:?BACKUP_DATABASE_URL is required}"
: "${RESTIC_REPOSITORY:?RESTIC_REPOSITORY is required}"
: "${RESTIC_PASSWORD:?RESTIC_PASSWORD is required}"

case "$RESTIC_REPOSITORY" in
  rclone:*|/*)
    ;;
  *)
    echo "RESTIC_REPOSITORY must use rclone:<remote>:<path> or an absolute local path." >&2
    exit 1
    ;;
esac
