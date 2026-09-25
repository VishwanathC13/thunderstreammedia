#!/usr/bin/env bash
# One-time setup for a fresh Ubuntu 22.04/24.04 server. Run as root, from the
# cloned repo:   bash /srv/thunderstream/deploy/setup-server.sh
# Safe to re-run — every step skips what's already done.
set -euo pipefail

APP=/srv/thunderstream
WEB=/var/www/thunderstream
BACKUPS=/var/backups/thunderstream
APP_USER=tsm

[ "$(id -u)" -eq 0 ] || { echo "Run this as root."; exit 1; }
[ -f "$APP/deploy/Caddyfile" ] || { echo "Clone the repo to $APP first (see deploy/README.md)."; exit 1; }
export DEBIAN_FRONTEND=noninteractive

echo "==> System packages"
apt-get update -y
apt-get install -y curl git rsync ufw fail2ban unattended-upgrades ca-certificates gnupg \
  debian-keyring debian-archive-keyring apt-transport-https postgresql redis-server

echo "==> Node.js 22"
if ! command -v node >/dev/null || [ "$(node -p 'process.versions.node.split(".")[0]')" -lt 22 ]; then
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
  apt-get install -y nodejs
fi
command -v pm2 >/dev/null || npm install -g pm2

echo "==> Caddy"
if ! command -v caddy >/dev/null; then
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' > /etc/apt/sources.list.d/caddy-stable.list
  apt-get update -y
  apt-get install -y caddy
fi

echo "==> Firewall (SSH, HTTP, HTTPS only) and automatic security updates"
ufw allow OpenSSH >/dev/null
ufw allow 80/tcp >/dev/null
ufw allow 443/tcp >/dev/null
ufw --force enable >/dev/null
dpkg-reconfigure -f noninteractive unattended-upgrades
systemctl enable --now fail2ban >/dev/null

# Small servers run out of memory during the frontend build without swap.
if [ "$(swapon --show --noheadings | wc -l)" -eq 0 ]; then
  echo "==> Adding 2 GB swap"
  fallocate -l 2G /swapfile && chmod 600 /swapfile && mkswap /swapfile >/dev/null && swapon /swapfile
  grep -q '/swapfile' /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab
fi

echo "==> App user and folders"
id "$APP_USER" >/dev/null 2>&1 || useradd -m -s /bin/bash "$APP_USER"
mkdir -p "$WEB" "$BACKUPS" "$APP/server/uploads" "$APP/server/tmp"
chown -R "$APP_USER":"$APP_USER" "$APP" "$WEB" "$BACKUPS"
touch /var/log/thunderstream-backup.log && chown "$APP_USER" /var/log/thunderstream-backup.log

echo "==> Database and Redis (both listen on this machine only)"
systemctl enable --now postgresql redis-server >/dev/null
ENV_FILE="$APP/server/.env"
if ! sudo -u postgres psql -Atc "SELECT 1 FROM pg_roles WHERE rolname='thunderstream'" | grep -q 1; then
  DB_PASS=$(openssl rand -hex 20)
  sudo -u postgres psql -qc "CREATE ROLE thunderstream LOGIN PASSWORD '$DB_PASS'"
  sudo -u postgres createdb -O thunderstream thunderstream
  DB_URL="postgresql://thunderstream:${DB_PASS}@127.0.0.1:5432/thunderstream?schema=public"
elif [ -f "$ENV_FILE" ]; then
  DB_URL=""   # role exists and .env already has its URL — leave both untouched
else
  echo "Database role exists but $ENV_FILE is missing; reset its password and set DATABASE_URL by hand."; exit 1
fi

echo "==> Server config file (server/.env)"
if [ ! -f "$ENV_FILE" ]; then
  cp "$APP/deploy/env.production.example" "$ENV_FILE"
  sed -i "s|^DATABASE_URL=.*|DATABASE_URL=\"$DB_URL\"|" "$ENV_FILE"
  sed -i "s|^JWT_SECRET=.*|JWT_SECRET=\"$(openssl rand -hex 32)\"|" "$ENV_FILE"
  chown "$APP_USER":"$APP_USER" "$ENV_FILE"; chmod 600 "$ENV_FILE"
fi

echo "==> Let the app user reload Caddy and start pm2 on boot"
cat > /etc/sudoers.d/tsm-deploy <<SUDO
$APP_USER ALL=(root) NOPASSWD: /usr/bin/install -m 644 $APP/deploy/Caddyfile /etc/caddy/Caddyfile, /usr/bin/systemctl reload caddy
SUDO
chmod 440 /etc/sudoers.d/tsm-deploy
visudo -cf /etc/sudoers.d/tsm-deploy >/dev/null
env PATH="$PATH" pm2 startup systemd -u "$APP_USER" --hp "/home/$APP_USER" >/dev/null

echo "==> Nightly backup at 03:00"
echo "0 3 * * * $APP_USER $APP/deploy/backup.sh >> /var/log/thunderstream-backup.log 2>&1" > /etc/cron.d/thunderstream-backup

install -m 644 "$APP/deploy/Caddyfile" /etc/caddy/Caddyfile
systemctl enable caddy >/dev/null; systemctl reload caddy || systemctl restart caddy

cat <<DONE

Server ready. Next:
  1. nano $ENV_FILE        (add your Razorpay / SendGrid / Google / WhatsApp keys)
  2. su - $APP_USER
  3. cd $APP && ./deploy/deploy.sh
Then create your owner login — see step 6 in deploy/README.md.
DONE
