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
mkdir -p /srv/zumra/data/{postgres,redis,clamav,media} /srv/zumra/runtime/media-jobs
chmod 777 /srv/zumra/data/media /srv/zumra/runtime/media-jobs   # demo: containers run as different uids
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

## Notes

- ClamAV downloads its signature DB on first boot (a few minutes); uploads are
  scanned, so they only succeed once it is ready.
- Google Meet is disabled (`GOOGLE_MEET_ENABLED=false`). To enable it later, add
  the service-account vars to `/srv/zumra/demo.env` and recreate the app/worker.
- This is the demo stack. The full production setup (blue-green, pgbackrest,
  restic, Cloudflare, monitoring) lives in `infra/production/`.
