# Deploying Thunderstream Media

One small Ubuntu server runs everything: the website, the API, Postgres and
Redis. Caddy serves the site over HTTPS (free, automatic certificates) and
passes `/api`, `/media` and `/health` to the Node app. Everything is hosted
on `https://thunderstreammedia.com` — there is no separate API domain.

Server size: **1 GB RAM works** for launch traffic (the setup script adds swap
so the build doesn't run out of memory). If deploys fail with "killed" or the
site feels slow, resize to 2 GB in your provider's dashboard.

## 0. Put the code on GitHub (once)

The folder isn't a git repository yet. From your laptop, in the project folder:

```bash
git init && git add . && git commit -m "Initial commit"
```

`.env` files are already ignored, so your keys are not included. Create a
**private** repository on GitHub, then push (GitHub shows the exact two
commands after you create the repo).

For the server to read a private repo, create a **fine-grained personal access
token** at GitHub → Settings → Developer settings, with access to only this
repo and **Contents: Read-only**. Keep it handy for step 3.

## 1. Create the server

At DigitalOcean / Vultr / Lightsail create a server with:
- **Ubuntu 24.04 LTS**, 1 GB RAM or more, a **Bangalore or Mumbai** region
- **SSH key login** (add your public key when creating it) rather than a password

Note the server's **IP address**.

## 2. Point the domain at it (Namecheap)

Domain List → **Manage** → **Advanced DNS**:
1. Delete the default records (the `parkingpage.namecheap.com` CNAME and any
   "URL Redirect" record).
2. Add **A Record**, Host `@`, Value = your server IP.
3. Add **A Record**, Host `www`, Value = your server IP.

Nameservers must be "Namecheap BasicDNS" (the default). Check it worked:
`dig +short thunderstreammedia.com` should print your IP (can take up to 30
minutes). **Do this before step 5** — HTTPS certificates need it.

## 3. One-time server setup

```bash
ssh root@YOUR_SERVER_IP
apt-get update && apt-get install -y git
git clone https://YOUR_GITHUB_USER:YOUR_TOKEN@github.com/YOUR_GITHUB_USER/YOUR_REPO.git /srv/thunderstream
git -C /srv/thunderstream remote set-url origin https://github.com/YOUR_GITHUB_USER/YOUR_REPO.git
bash /srv/thunderstream/deploy/setup-server.sh
```

The script installs Node, Postgres, Redis and Caddy, turns on the firewall,
security updates and nightly backups, creates the database, and writes
`server/.env` with a generated database password and login secret.

## 4. Add your keys

```bash
nano /srv/thunderstream/server/.env
```

Fill in whichever integrations you want live (Razorpay, SendGrid, Google,
WhatsApp). Anything left as `*_ENABLED=false` runs in mock mode. Save with
Ctrl+O, Enter, Ctrl+X.

## 5. First deploy

```bash
su - tsm
git config --global credential.helper store      # remembers the GitHub token
cd /srv/thunderstream && ./deploy/deploy.sh
```

The first `git pull` asks for your GitHub username and the token, then
remembers them. When it finishes, open `https://thunderstreammedia.com`.

## 6. Create your admin login

Still as `tsm`, choose your own username and a strong password (12+ characters):

```bash
cd /srv/thunderstream/server
read -rp "Owner username: " SEED_OWNER_EMAIL
read -rsp "Owner password: " SEED_OWNER_PASSWORD; echo
export SEED_OWNER_EMAIL SEED_OWNER_PASSWORD
npm run prisma:seed:prod
unset SEED_OWNER_PASSWORD
```

This adds your login, the booking-capacity setting and your 18 price-list
services. It never adds demo content. Sign in at `/admin/login`.

## 7. Things to redo for the live site

| What | Where |
|---|---|
| Google Calendar | Add `https://thunderstreammedia.com/api/admin/google-calendar/callback` as a second redirect URI on your OAuth client, then click **Connect Google Calendar** in Admin → Settings (the connection lives in the database, so it starts fresh) |
| WhatsApp webhook | In Meta, set the Callback URL to `https://thunderstreammedia.com/api/webhooks/whatsapp` and the Verify token to `WHATSAPP_WEBHOOK_VERIFY_TOKEN` from `.env`; subscribe to `messages` |
| Razorpay | Replace the test keys with live keys in `.env` once your account is activated, set `RAZORPAY_ENABLED=true` |
| SendGrid | Authenticate your domain in SendGrid (it gives you CNAME records to add under Namecheap → Advanced DNS) so email doesn't land in spam |

After editing `.env`, apply it with `pm2 restart thunderstream-api` (as `tsm`).

## Updating the site later

**Via GitHub (the normal path now):** on your laptop, build and test the
change, then `git add -A && git commit -m "..."` and `git push`. Then, on the
server, as `tsm`:

```bash
cd /srv/thunderstream && ./deploy/deploy.sh
```

The server has its own read-only SSH deploy key for the GitHub repo (added
under repo Settings → Deploy keys), so `git pull` there needs no password or
token. `deploy.sh` pulls, backs up the database, applies any new migrations,
rebuilds the site, and restarts the API.

**Without GitHub (fallback):** `./deploy/push-to-server.sh` from the project
folder on your laptop uploads the working tree directly and deploys it,
skipping git entirely. Useful if GitHub is unreachable or for a quick
throwaway test you don't want in history.

```bash
ssh tsm@YOUR_SERVER_IP        # or: ssh root@... then su - tsm
cd /srv/thunderstream && ./deploy/deploy.sh
```

It pulls the code, backs up the database, applies any new database
migrations, rebuilds the site and restarts the API (a few seconds of
interruption at most). If a migration ever fails, the script stops before
touching the running site.

## Backups

- A backup runs every night at 03:00 and before every deploy, kept in
  `/var/backups/thunderstream` (database 14 days, uploads 7 days).
- These protect against mistakes and bad migrations. They do **not** protect
  against losing the server itself — turn on your provider's automatic
  snapshots (about $1/month) or copy the folder off the server now and then.
- Restore a database backup (as root):
  ```bash
  pm2 stop thunderstream-api      # as tsm
  gunzip -c /var/backups/thunderstream/db-YYYY-MM-DD-HHMM.sql.gz | sudo -u postgres psql thunderstream
  pm2 start thunderstream-api     # as tsm
  ```

## When something's wrong

| Symptom | Check |
|---|---|
| Site won't load / certificate error | DNS still pointing at the server? `sudo journalctl -u caddy -n 50` |
| Pages load but data is missing / errors | `pm2 logs thunderstream-api --lines 100` (as `tsm`) |
| API won't start after a deploy | The log usually says why; a missing/weak `JWT_SECRET` in `.env` stops it on purpose |
| "Killed" during deploy | Out of memory — resize the server to 2 GB |
| Seat holds fail | `systemctl status redis-server` |
