#!/usr/bin/env bash
set -euo pipefail

root="/srv/zumra"
release_dir="$(readlink -f "${root}/current")"

exec docker compose \
  --env-file "${root}/shared/infra.env" \
  --env-file "${root}/shared/deploy.env" \
  -f "${release_dir}/infra/production/compose.yaml" \
  "$@"
