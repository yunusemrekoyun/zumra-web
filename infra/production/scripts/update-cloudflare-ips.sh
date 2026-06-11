#!/usr/bin/env bash
set -euo pipefail

destination="${1:-/srv/zumra/shared/nginx/cloudflare-real-ip.conf}"
temporary="${destination}.new"
mkdir -p "$(dirname "$destination")"

{
  echo "real_ip_header CF-Connecting-IP;"
  echo "real_ip_recursive on;"
  curl -fsSL https://www.cloudflare.com/ips-v4/ | sed 's|^|set_real_ip_from |; s|$|;|'
  curl -fsSL https://www.cloudflare.com/ips-v6/ | sed 's|^|set_real_ip_from |; s|$|;|'
} > "$temporary"

mv "$temporary" "$destination"
