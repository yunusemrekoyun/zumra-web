#!/usr/bin/env bash
set -euo pipefail

root="/srv/zumra"
shared="${root}/shared"
compose="${root}/current/infra/production/scripts/compose.sh"
active_slot="$(cat "${shared}/active-slot")"
readiness_token="$(sed -n 's/^READINESS_TOKEN=//p' "${shared}/app.env" | tail -n 1)"
push_url="$(sed -n 's/^UPTIME_KUMA_OPS_PUSH_URL=//p' "${shared}/infra.env" | tail -n 1)"

health_ok=false
if "$compose" exec -T "app_${active_slot}" \
  node -e "fetch('http://127.0.0.1:3000/api/health/ops',{headers:{authorization:'Bearer ${readiness_token}'}}).then(async r=>{console.log(await r.text());if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"; then
  health_ok=true
fi

five_xx_count="$(
  "$compose" logs --since 5m nginx 2>/dev/null |
    awk '$0 ~ /" [5][0-9][0-9] / { count += 1 } END { print count + 0 }'
)"

if [[ "$health_ok" == "true" && "$five_xx_count" -lt 10 ]]; then
  status="up"
  message="ops healthy; 5xx=${five_xx_count}"
else
  status="down"
  message="ops degraded; health=${health_ok}; 5xx=${five_xx_count}"
fi

if [[ -n "$push_url" ]]; then
  push_url="${push_url%%\?*}"
  curl -fsS \
    "${push_url}?status=${status}&msg=$(printf '%s' "$message" | jq -sRr @uri)&ping=" \
    >/dev/null
fi

[[ "$status" == "up" ]]
