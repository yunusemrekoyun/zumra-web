#!/usr/bin/env bash
set -euo pipefail

if [[ $# -lt 1 ]]; then
  echo "Usage: $0 user@host [release-id]" >&2
  exit 1
fi

target="$1"
release_id="${2:-$(date -u +%Y%m%d%H%M%S)}"
remote_root="/srv/zumra/releases/${release_id}"

ssh "$target" "mkdir -p '$remote_root'"
rsync -az --delete \
  --exclude '.git/' \
  --exclude '.next/' \
  --exclude '.data/' \
  --exclude '.env' \
  --exclude '.env.*' \
  --exclude 'backups/' \
  --exclude 'node_modules/' \
  --exclude 'releases/' \
  --exclude 'runtime/' \
  ./ "${target}:${remote_root}/"

ssh "$target" "bash '${remote_root}/infra/production/scripts/activate-release.sh' '${release_id}'"
