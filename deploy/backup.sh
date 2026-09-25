#!/usr/bin/env bash
# Database + uploaded-media backup. Runs nightly (cron) and before every deploy.
# Copies stay on this server for 14 days (database) / 7 days (media). To also
# survive losing the whole server, download them now and then or enable your
# provider's server snapshots — see deploy/README.md.
set -euo pipefail

APP=/srv/thunderstream
DIR=/var/backups/thunderstream
STAMP=$(date +%F-%H%M)
mkdir -p "$DIR"

DB_URL=$(grep '^DATABASE_URL=' "$APP/server/.env" | cut -d= -f2- | tr -d '"')
pg_dump "${DB_URL%%\?*}" | gzip > "$DIR/db-$STAMP.sql.gz"   # strip Prisma's ?schema= suffix, pg_dump rejects it

if [ -d "$APP/server/uploads" ] && [ -n "$(ls -A "$APP/server/uploads" 2>/dev/null)" ]; then
  tar -czf "$DIR/uploads-$STAMP.tar.gz" -C "$APP/server" uploads
fi

find "$DIR" -name 'db-*.sql.gz' -mtime +14 -delete
find "$DIR" -name 'uploads-*.tar.gz' -mtime +7 -delete
echo "$(date -Is) backup ok: db-$STAMP.sql.gz"
