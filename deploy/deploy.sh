#!/usr/bin/env bash
# Deploy the latest code. Run as the app user from the repo:
#   su - tsm
#   cd /srv/thunderstream && ./deploy/deploy.sh
# Use for the first deploy and for every update afterwards.
set -euo pipefail

APP=/srv/thunderstream
WEB=/var/www/thunderstream
DOMAIN=thunderstreammedia.com

[ "$(id -un)" = "tsm" ] || { echo "Run as the app user:  su - tsm"; exit 1; }
cd "$APP"
[ -f server/.env ] || { echo "server/.env is missing — run deploy/setup-server.sh first."; exit 1; }
if grep -q 'CHANGE_ME' server/.env; then echo "server/.env still contains CHANGE_ME placeholders."; exit 1; fi

if [ -z "${SKIP_PULL:-}" ]; then
  echo "==> Pulling latest code"
  git pull --ff-only
fi

# Only meaningful once a database exists; skipped on the very first deploy.
if [ -d "$APP/server/node_modules/.prisma" ]; then
  echo "==> Backing up the database before migrating"
  ./deploy/backup.sh
fi

echo "==> Backend: dependencies and database migrations"
( cd server && npm ci && npx prisma generate && npx prisma migrate deploy )

echo "==> Frontend: build"
npm ci
VITE_API_URL="https://$DOMAIN" npm run build
rsync -a --delete dist/ "$WEB"/

echo "==> Web server config"
if ! cmp -s deploy/Caddyfile /etc/caddy/Caddyfile; then
  sudo /usr/bin/install -m 644 "$APP/deploy/Caddyfile" /etc/caddy/Caddyfile
  sudo /usr/bin/systemctl reload caddy
fi

echo "==> Restarting the API"
pm2 startOrReload deploy/ecosystem.config.cjs --update-env
pm2 save >/dev/null

echo "==> Health check"
curl -fsS --retry 15 --retry-delay 1 --retry-connrefused http://127.0.0.1:4000/health && echo
echo "Deployed. Site: https://$DOMAIN"
