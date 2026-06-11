#!/usr/bin/env bash
set -euo pipefail

if [[ "${EUID}" -ne 0 ]]; then
  echo "Run configure-origin-firewall.sh as root." >&2
  exit 1
fi

: "${SSH_ALLOW_CIDR:?Set SSH_ALLOW_CIDR to the trusted administration CIDR.}"

ufw --force reset
ufw default deny incoming
ufw default allow outgoing
ufw allow from "$SSH_ALLOW_CIDR" to any port 22 proto tcp

while read -r cidr; do
  [[ -n "$cidr" ]] && ufw allow from "$cidr" to any port 80 proto tcp
  [[ -n "$cidr" ]] && ufw allow from "$cidr" to any port 443 proto tcp
done < <(
  {
    curl -fsSL https://www.cloudflare.com/ips-v4/
    curl -fsSL https://www.cloudflare.com/ips-v6/
  }
)

ufw --force enable
ufw status verbose
