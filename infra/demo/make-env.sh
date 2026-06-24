#!/usr/bin/env bash
set -euo pipefail

# Generates the demo env file with fresh random secrets + known demo config.
# The SMTP app password is taken from the environment so it never lives in git:
#
#   SMTP_RELAY_PASSWORD='your-app-password' bash infra/demo/make-env.sh
#
# Re-running regenerates secrets (the previous file is backed up).

ENV_PATH="${ENV_PATH:-/srv/zumra/demo.env}"

if [[ -z "${SMTP_RELAY_PASSWORD:-}" ]]; then
  echo "SMTP_RELAY_PASSWORD gerekli (Google app password)." >&2
  echo "Kullanim: SMTP_RELAY_PASSWORD='xxxx...' bash infra/demo/make-env.sh" >&2
  exit 1
fi

mkdir -p "$(dirname "$ENV_PATH")"
if [[ -f "$ENV_PATH" ]]; then
  cp "$ENV_PATH" "$ENV_PATH.bak.$(date +%s)"
fi

# hex -> URL-safe (these go into DATABASE_URL / REDIS_URL)
PG_PW="$(openssl rand -hex 24)"
REDIS_PW="$(openssl rand -hex 24)"
# >= 48 char application secrets
AUTH_SECRET="$(openssl rand -base64 48 | tr -d '\n')"
DEVICE_SECRET="$(openssl rand -base64 48 | tr -d '\n')"
OUTBOX_SECRET="$(openssl rand -base64 48 | tr -d '\n')"
IDENTITY_SECRET="$(openssl rand -base64 48 | tr -d '\n')"
READINESS="$(openssl rand -hex 24)"

umask 077
cat > "$ENV_PATH" <<EOF
# Generated $(date -u +%FT%TZ) — demo only, do NOT commit.
POSTGRES_PASSWORD=$PG_PW
REDIS_PASSWORD=$REDIS_PW
BETTER_AUTH_SECRET=$AUTH_SECRET
DEVICE_COOKIE_SECRET=$DEVICE_SECRET
OUTBOX_ENCRYPTION_SECRET=$OUTBOX_SECRET
IDENTITY_ENCRYPTION_SECRET=$IDENTITY_SECRET
READINESS_TOKEN=$READINESS

# Mail — Google Workspace
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_REQUIRE_TLS=true
SMTP_FROM=Zümra Akademi <meet@yunusemrekoyun.com>
SMTP_RELAY_USER=meet@yunusemrekoyun.com
SMTP_RELAY_PASSWORD=$SMTP_RELAY_PASSWORD

# Public — baked into the build
NEXT_PUBLIC_WHATSAPP_NUMBER=905428928236
EOF

chmod 600 "$ENV_PATH"
echo "Yazildi: $ENV_PATH (chmod 600)"
