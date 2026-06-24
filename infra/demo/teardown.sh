#!/usr/bin/env bash
set -euo pipefail

# Cleanly removes the Zümra demo. Everything here is scoped to the "zumra-demo"
# compose project, the yunusemrekoyun.tech nginx site, and /srv/zumra — it does
# NOT touch the other projects, the host redis, or the other nginx sites.
#
#   bash infra/demo/teardown.sh           # remove containers + images + nginx site + cert (keeps data)
#   bash infra/demo/teardown.sh --purge   # also delete /srv/zumra (ALL demo data)

cd "$(dirname "$0")/../.."
COMPOSE="docker compose -f infra/demo/compose.yaml --env-file /srv/zumra/demo.env"

echo ">> Konteynerler + zumra-demo agi kaldiriliyor"
$COMPOSE down --remove-orphans || true

echo ">> Sadece zumra demo imajlari kaldiriliyor"
docker rmi zumra-demo-app:latest zumra-demo-worker:latest zumra-demo-media:latest 2>/dev/null || true

echo ">> nginx site kaldiriliyor (diger siteler etkilenmez)"
rm -f /etc/nginx/sites-enabled/yunusemrekoyun.tech /etc/nginx/sites-available/yunusemrekoyun.tech
if nginx -t 2>/dev/null; then systemctl reload nginx; fi

echo ">> TLS sertifikasi kaldiriliyor"
certbot delete --cert-name yunusemrekoyun.tech --non-interactive 2>/dev/null || true

if [[ "${1:-}" == "--purge" ]]; then
  echo ">> /srv/zumra (tum demo verisi) siliniyor"
  rm -rf /srv/zumra
else
  echo ">> Veri korundu: /srv/zumra  (tamamen silmek icin: bash infra/demo/teardown.sh --purge)"
fi

echo ">> Bitti. Diger projeler / portlar / host redis / diger nginx siteleri dokunulmadi."
