#!/usr/bin/env bash
set -euo pipefail

if [[ "${EUID}" -ne 0 ]]; then
  echo "Run install-systemd-timers.sh as root." >&2
  exit 1
fi

source_dir="/srv/zumra/current/infra/production/systemd"
install -m 0644 "${source_dir}"/*.service "${source_dir}"/*.timer /etc/systemd/system/
systemctl daemon-reload
systemctl enable --now \
  zumra-backup-logical.timer \
  zumra-backup-differential.timer \
  zumra-backup-full.timer \
  zumra-backup-wal.timer \
  zumra-backup-restic.timer \
  zumra-restic-forget.timer \
  zumra-restic-prune.timer \
  zumra-restic-check.timer \
  zumra-ops-monitor.timer

systemctl list-timers 'zumra-*' --no-pager
