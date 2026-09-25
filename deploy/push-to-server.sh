#!/usr/bin/env bash
# Run on your laptop, from the project folder:  ./deploy/push-to-server.sh
# Uploads the current code to the server and deploys it (backup, migrate,
# rebuild, restart). Use this instead of `git pull` if the project isn't on
# GitHub. Never uploads .env files, node_modules or the server's uploads.
set -euo pipefail

SERVER_IP=34.93.153.216
SERVER_USER=vishwanathc
SSH_KEY="$HOME/.ssh/google_compute_engine"
SSH=(ssh -i "$SSH_KEY" -o UserKnownHostsFile="$HOME/.ssh/google_compute_known_hosts" "$SERVER_USER@$SERVER_IP")

cd "$(dirname "$0")/.."

echo "==> Uploading code"
COPYFILE_DISABLE=1 tar czf - 2>/dev/null \
  --exclude=node_modules --exclude=dist --exclude=.git --exclude=.env --exclude=server/.env \
  --exclude='server/uploads/*' --exclude='server/tmp/*' --exclude='*.log' --exclude=.DS_Store \
  --exclude='Screenshot*.png' --exclude='TSM PNG.png' --exclude=.claude . \
  | "${SSH[@]}" 'sudo -u tsm tar xzf - -C /srv/thunderstream --warning=no-unknown-keyword 2>/dev/null'

echo "==> Deploying"
"${SSH[@]}" 'sudo -u tsm -H bash -c "cd /srv/thunderstream && SKIP_PULL=1 ./deploy/deploy.sh"' 2>&1 | grep -v 'setlocale\|perl: warning\|LANG\|LC_\|locale'
