# Zümra — VPS demo deploy

Single-instance demo stack behind the system nginx on the Hostinger VPS.
App runs on `127.0.0.1:3004`; nginx terminates TLS for `yunusemrekoyun.tech`.

Layout on the box:

```
/srv/zumra/app                 # this repo (git clone)
/srv/zumra/demo.env            # generated secrets + config (chmod 600, not in git)
/srv/zumra/data/{postgres,redis,clamav,media}
/srv/zumra/runtime/media-jobs
```

All commands run as root on the VPS.

## 1 — Directories + code

```bash
mkdir -p /srv/zumra/data/{postgres,redis,clamav,media,mailpit} /srv/zumra/runtime/media-jobs
chmod 777 /srv/zumra/data/media /srv/zumra/runtime/media-jobs /srv/zumra/data/mailpit   # demo: containers run as different uids
git clone https://github.com/yunusemrekoyun/zumra-web.git /srv/zumra/app
cd /srv/zumra/app
```

## 2 — Environment

Secrets are generated on the box; the SMTP app password comes from your shell so
it never lands in git:

```bash
SMTP_RELAY_PASSWORD='<google-app-password>' bash infra/demo/make-env.sh
```

## 3 — Build + start

```bash
DC="docker compose -f infra/demo/compose.yaml --env-file /srv/zumra/demo.env"
$DC up -d --build          # first build takes a few minutes
$DC ps
```

## 4 — Database

```bash
$DC run --rm worker node dist/migrate.cjs
$DC run --rm -e ALLOW_DEMO_SEED=true worker node dist/seed-demo.cjs
```

## 5 — Smoke test the app

```bash
curl -sS -o /dev/null -w "%{http_code}\n" http://127.0.0.1:3004   # expect 200/3xx
```

## 6 — nginx + TLS

```bash
cp infra/demo/nginx-yunusemrekoyun.tech.conf /etc/nginx/sites-available/yunusemrekoyun.tech
ln -sf /etc/nginx/sites-available/yunusemrekoyun.tech /etc/nginx/sites-enabled/yunusemrekoyun.tech
nginx -t && systemctl reload nginx
certbot --nginx -d yunusemrekoyun.tech -d www.yunusemrekoyun.tech
```

Then open https://yunusemrekoyun.tech.

## 7 — Mail mode + Mailpit (test inbox)

Real device verification (email OTP) and admin MFA/TOTP are **enforced** — the old
`DEMO_TRUST_DEVICES` bypass is gone. Because the seeded accounts use placeholder
`@zumra.local` addresses, real SMTP can't deliver their OTPs. So the stack ships a
**mailpit** container and a runtime **mail mode** toggle (Admin → Settings → "Mail
delivery mode"):

- **live** — mail goes to the real relay (Gmail) → real addresses.
- **test** — mail is captured by the in-stack mailpit (`mailpit:1025`), never
  delivered. Read OTPs/invites from the mailpit web inbox.

The default is **live**. For the demo, sign in as admin and switch it to **test**.

First-run sequence after this deploy (no DEMO_TRUST_DEVICES):

1. Admin signs in with the password → lands at `pending` security → the app routes
   to MFA setup (`/mfa-kurulum`). Enroll an authenticator (Google Authenticator,
   etc.) once. (TOTP is app-based, so this needs no email.)
2. In Admin → Settings, set **Mail delivery mode = test**.
3. Now non-admin (teacher/student) sign-ins trigger an email OTP that lands in
   mailpit — read the code there to complete device verification.

The mailpit UI is published on the loopback only (`127.0.0.1:8025`). Expose it
behind nginx basic-auth at a protected path so it isn't public:

```bash
# one-time: create a credential
apt-get install -y apache2-utils
htpasswd -c /etc/nginx/zumra-mail.htpasswd youruser

# in the yunusemrekoyun.tech server block, add:
#   location /mail/ {
#     auth_basic "Zumra Mail";
#     auth_basic_user_file /etc/nginx/zumra-mail.htpasswd;
#     proxy_pass http://127.0.0.1:8025/;
#     proxy_set_header Host $host;
#   }
nginx -t && systemctl reload nginx
```

Then read captured mail at `https://yunusemrekoyun.tech/mail/`.

## Updating later

```bash
cd /srv/zumra/app && git pull
DC="docker compose -f infra/demo/compose.yaml --env-file /srv/zumra/demo.env"
$DC up -d --build
$DC run --rm worker node dist/migrate.cjs    # only if new migrations
```

## Logs / ops

```bash
$DC logs -f --tail=100 app
$DC logs -f --tail=100 worker
$DC restart app
$DC down                 # stop (keeps volumes/data on disk)
```

## Isolation — what this touches

Everything is namespaced and self-contained; the other projects on the box are
untouched:

- **Containers / network / volumes:** all under the `zumra-demo` compose project
  (`zumra-demo-*`). Data is bind-mounted under `/srv/zumra` only — no named
  volumes, no shared paths.
- **Port:** binds `127.0.0.1:3004` only (3000/3001/3002 stay free for the others).
- **Host Redis (6379):** not used — this stack runs its own Redis on the internal
  network, not published.
- **System nginx:** adds one new site (`yunusemrekoyun.tech`); the existing site
  files are not modified. `nginx -t` gates every reload.
- **certbot:** adds a cert for `yunusemrekoyun.tech` only; other certs untouched.
- **Memory:** every service has a hard memory limit so a runaway container can't
  starve the neighbours.

## Teardown

```bash
cd /srv/zumra/app
bash infra/demo/teardown.sh           # remove containers + images + nginx site + cert (keeps data)
bash infra/demo/teardown.sh --purge   # also delete /srv/zumra (all demo data)
```

Removes only zumra-demo resources — the other projects, host Redis, and other
nginx sites are left alone.

## Notes

- ClamAV downloads its signature DB on first boot (a few minutes); uploads are
  scanned, so they only succeed once it is ready.
- Google Meet is disabled (`GOOGLE_MEET_ENABLED=false`). To enable it later, add
  the service-account vars to `/srv/zumra/demo.env` and recreate the app/worker.
- This is the demo stack. The full production setup (blue-green, pgbackrest,
  restic, Cloudflare, monitoring) lives in `infra/production/`.
