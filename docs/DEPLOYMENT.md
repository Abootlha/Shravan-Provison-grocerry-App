# Backend deployment (VPS + PM2)

The NestJS backend is deployed automatically to the VPS whenever a change under
`backend/` lands on `main` (production) or `develop` (the development instance,
see [Development environment](#development-environment)). Both run on the same
server as separate PM2 apps.

```
GitHub (push to main → production, push to develop → development)
  └─ .github/workflows/deploy-backend.yml
       verify:  npm ci → eslint → tsc --noEmit → jest → nest build → release.tar.gz
       deploy:  scp release + remote-deploy.sh → ssh: remote-deploy.sh deploy
                  └─ extract → npm ci --omit=dev → switch `current` → pm2 reload
                     → health check → keep (prune old) | roll back (job fails)

Client → Cloudflare (api.shravanprovision.com) → nginx on the VPS → 127.0.0.1:3000 (PM2: shravan-backend)
```

Files involved:

| File | Purpose |
|------|---------|
| `.github/workflows/deploy-backend.yml` | Build, test, package and deploy (or roll back) |
| `backend/scripts/deploy/remote-deploy.sh` | Runs on the server: install, switch, reload, health check, rollback |
| `backend/ecosystem.config.js` | PM2 app definition (`shravan-backend`, or `PM2_APP_NAME`) |
| `backend/.nvmrc` | Node major version used by CI and the server (22) |

`.github/workflows/ci-cd.yml` only runs checks (all packages, on PRs and pushes).

## Server layout

```
/var/www/shravan-backend/            DEPLOY_PATH (owned by deploy:deploy)
├── current -> releases/20261011120000-1a2b3c4d5e6f
├── releases/
│   ├── 20261010093000-9f8e7d6c5b4a/  dist/, node_modules/, package*.json, .nvmrc,
│   └── 20261011120000-1a2b3c4d5e6f/  ecosystem.config.js, scripts/, REVISION, .env -> ../../shared/.env
├── shared/
│   ├── .env                          production config (chmod 600, never in git)
│   └── logs/                         out.log, error.log (PM2)
├── incoming/                         upload area used by the workflow
├── DEPLOYED_SHA                      commit currently live
├── APP_NAME                          PM2 app that owns this directory (deploys with another name are refused)
└── .deploy.lock                      prevents overlapping deploys (flock)
```

The newest 5 releases are kept. PM2 runs the app from `current`, so a reload
always starts whichever release `current` points at. The app reads `.env` from
its working directory (`@nestjs/config` default), which is the shared file.

## One-time server setup

Commands assume Ubuntu/Debian and an admin account with sudo. Only the setup
needs sudo; deploys run as the unprivileged `deploy` user.

### 1. Deploy user and directories

```bash
sudo adduser --disabled-password --gecos "" deploy
sudo mkdir -p /var/www/shravan-backend/{releases,shared/logs,incoming}
sudo chown -R deploy:deploy /var/www/shravan-backend
sudo chmod 750 /var/www/shravan-backend
sudo apt-get install -y curl tar util-linux   # curl, tar and flock are used by the deploy script
```

### 2. Node (nvm) and PM2, as `deploy`

```bash
sudo -iu deploy
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash
source ~/.nvm/nvm.sh
nvm install 22            # must match backend/.nvmrc
nvm alias default 22
npm install -g pm2
pm2 install pm2-logrotate # optional: rotate shared/logs/*.log
exit
```

`sharp` and `bcrypt` are native modules. They are installed on the server
(`npm ci --omit=dev` in each release), so they always match the server's
platform; prebuilt linux-x64 binaries are downloaded, no compiler needed.

If you later change the Node major in `backend/.nvmrc`: as `deploy`, run
`nvm install <new>`, `nvm alias default <new>`, `npm install -g pm2`, then
`pm2 update`. The deploy script refuses to deploy when the server's Node major
does not match `.nvmrc`.

### 3. PM2 on boot (systemd)

```bash
sudo -iu deploy bash -c 'source ~/.nvm/nvm.sh && pm2 startup systemd -u deploy --hp /home/deploy'
# PM2 prints a `sudo env PATH=... pm2 startup ...` command: run it as the admin user.
```

The deploy script runs `pm2 save` after every deploy, so the saved process
list always matches what is running.

### 4. Production config: `shared/.env`

```bash
sudo -iu deploy
install -m 600 /dev/null /var/www/shravan-backend/shared/.env
nano /var/www/shravan-backend/shared/.env
```

Start from `backend/.env.example`. Every variable:

| Variable | Notes |
|----------|-------|
| `NODE_ENV` | `production`. PM2 sets it from this file: `development` only if this says `development`, otherwise `production` |
| `PORT` | `3000`; nginx and the health check use it |
| `MONGODB_URI`, `MONGODB_DB` | Mongo connection; `MONGODB_DB` optional (defaults to the URI's database) |
| `REDIS_HOST`, `REDIS_PORT`, `REDIS_PASSWORD`, `REDIS_URL` | Redis for cache, BullMQ, Socket.IO adapter and login sessions |
| `REDIS_DB` | Redis database index, default `0`. Production keeps `0`; the development instance must use another one (`1`) |
| `CORS_ORIGINS` | Comma separated browser origins (admin panel, website) |
| `TRUST_PROXY` | `1` behind nginx (Cloudflare's real IP is restored by nginx, see below) |
| `PUBLIC_API_URL` | `https://api.shravanprovision.com` — base for PayU callbacks (`/api/v1/payments/success`, `/failure`, `/webhook`) |
| `PAYMENT_RETURN_URL` | `https://shravanprovision.com/` — where customers land after PayU; the app watches for `?payment=` and verifies with the server |
| `PAYU_ENV` | `production` for live keys (`test` for sandbox) |
| `JWT_SECRET`, `JWT_REFRESH_SECRET` | Required, 32+ random chars each, different from each other |
| `JWT_EXPIRES_IN` | Access token lifetime, e.g. `15m` |
| `JWT_REFRESH_IDLE_DAYS` | Customer/rider session idle timeout, default 365 |
| `JWT_ADMIN_REFRESH_IDLE_DAYS` | Admin session idle timeout, default 28 |
| `JWT_REFRESH_REUSE_GRACE_SECONDS` | Grace window for a just-rotated refresh token, default 300 |
| `TWOFACTOR_API_KEY`, `TWOFACTOR_TEMPLATE_NAME`, `OTP_LENGTH` | OTP SMS (required in production). `OTP_LENGTH` 4-6, default 4; the apps read it from the send-otp response |
| `OTP_FIXED_CODE` | **Never in production** (the app refuses to start). Development only, see below |
| `MAPMYINDIA_API_KEY`, `MAPMYINDIA_CLIENT_ID`, `MAPMYINDIA_CLIENT_SECRET` | Mappls (optional) |
| `GOOGLE_MAPS_API_KEY` | Maps, search, ETA |
| `STORE_LATITUDE`, `STORE_LONGITUDE`, `STORE_MAX_DELIVERY_KM` | Store location and delivery radius |
| `SOCKET_IO_CORS_ORIGIN` | Socket.IO allowed origins |
| `STALE_ORDER_THRESHOLD_MINUTES`, `ANOMALY_THRESHOLD_HOURS`, `ETA_RECALC_INTERVAL_MINUTES` | Order tracking jobs |
| `REDIS_CACHE_TTL_SECONDS`, `ETA_CACHE_TTL_SECONDS`, `LOCATION_THROTTLE_SECONDS`, `MAX_CONCURRENT_JOBS` | Performance tuning |
| `PAYU_KEY`, `PAYU_SALT`, `PAYU_CLIENT_ID`, `PAYU_CLIENT_SECRET` | Payments (required) |
| `PRODUCT_IMAGE_BG_PROVIDER`, `REMOVE_BG_API_KEY`, `REMBG_BIN`, `PRODUCT_IMAGE_TIMEOUT_MS` | Product image processing |
| `PM2_INSTANCES` | Optional, default `1`. See "Scaling" below |
| `PM2_MAX_MEMORY` | Optional, default `1G` (PM2 restarts an instance above this) |

Redis holds login sessions, so it must be persistent and must not evict keys.
In `/etc/redis/redis.conf`:

```
appendonly yes
maxmemory-policy noeviction
requirepass <strong password>     # then set REDIS_PASSWORD
bind 127.0.0.1 ::1
```

Wiping or evicting Redis signs every user out.

Variables exported in the `deploy` user's shell override `.env` (PM2 runs with
`--update-env`), so do not export app settings in `~/.bashrc`.

### 5. nginx

`/etc/nginx/sites-available/api.shravanprovision.com` (then symlink into `sites-enabled`,
`sudo nginx -t && sudo systemctl reload nginx`):

```nginx
# Restore the real client IP from Cloudflare. Keep this list current:
# https://www.cloudflare.com/ips-v4 and https://www.cloudflare.com/ips-v6
set_real_ip_from 173.245.48.0/20;
set_real_ip_from 103.21.244.0/22;
set_real_ip_from 103.22.200.0/22;
set_real_ip_from 103.31.4.0/22;
set_real_ip_from 141.101.64.0/18;
set_real_ip_from 108.162.192.0/18;
set_real_ip_from 190.93.240.0/20;
set_real_ip_from 188.114.96.0/20;
set_real_ip_from 197.234.240.0/22;
set_real_ip_from 198.41.128.0/17;
set_real_ip_from 162.158.0.0/15;
set_real_ip_from 104.16.0.0/13;
set_real_ip_from 104.24.0.0/14;
set_real_ip_from 172.64.0.0/13;
set_real_ip_from 131.0.72.0/22;
set_real_ip_from 2400:cb00::/32;
set_real_ip_from 2606:4700::/32;
set_real_ip_from 2803:f800::/32;
set_real_ip_from 2405:b500::/32;
set_real_ip_from 2405:8100::/32;
set_real_ip_from 2a06:98c0::/29;
set_real_ip_from 2c0f:f248::/32;
real_ip_header CF-Connecting-IP;

map $http_upgrade $connection_upgrade {
    default upgrade;
    ''      close;
}

upstream shravan_backend {
    server 127.0.0.1:3000;
    keepalive 32;
}

server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name api.shravanprovision.com;

    # Cloudflare Origin Certificate (or Let's Encrypt)
    ssl_certificate     /etc/ssl/cloudflare/api.shravanprovision.com.pem;
    ssl_certificate_key /etc/ssl/cloudflare/api.shravanprovision.com.key;

    # Admin product images are sent as base64 JSON (backend accepts up to 8 MB).
    client_max_body_size 10m;

    location /socket.io/ {
        proxy_pass http://shravan_backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection $connection_upgrade;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 120s;
        proxy_send_timeout 120s;
    }

    location / {
        proxy_pass http://shravan_backend;
        proxy_http_version 1.1;
        proxy_set_header Connection "";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 60s;
    }
}

server {
    listen 80;
    listen [::]:80;
    server_name api.shravanprovision.com;
    return 301 https://$host$request_uri;
}
```

The app listens on `0.0.0.0:3000`; block that port from the internet so only
nginx reaches it (e.g. `sudo ufw allow OpenSSH && sudo ufw allow 'Nginx Full' && sudo ufw enable`;
do not open 3000).

### 6. Cloudflare

- SSL/TLS mode: **Full (strict)** (use a Cloudflare Origin Certificate or a
  valid public certificate on nginx).
- Network → **WebSockets: On** (Socket.IO `/tracking` and `/orders`).
- Optionally firewall 80/443 on the VPS to Cloudflare's IP ranges only.

### 7. Deploy SSH key

On your own machine (not the server), create a key used only by GitHub Actions:

```bash
ssh-keygen -t ed25519 -C "github-actions-deploy" -f shravan_deploy_key -N ""
```

Add the public key to the server:

```bash
sudo -iu deploy mkdir -p -m 700 ~deploy/.ssh
# append the contents of shravan_deploy_key.pub to /home/deploy/.ssh/authorized_keys
sudo chmod 600 /home/deploy/.ssh/authorized_keys
sudo chown -R deploy:deploy /home/deploy/.ssh
```

Pin the server's host key (run from a trusted network, then compare the
fingerprint with `ssh-keygen -lf /etc/ssh/ssh_host_ed25519_key.pub` on the server):

```bash
ssh-keyscan -p 22 <server-ip-or-host> 2>/dev/null
```

Use the real SSH address of the VPS, not `api.shravanprovision.com` (that resolves to
Cloudflare, which does not proxy SSH). Use the same host value for `DEPLOY_HOST`.

Check it works: `ssh -i shravan_deploy_key deploy@<host> 'source ~/.nvm/nvm.sh && node -v && pm2 -v'`.
Delete the private key file from your machine once it is stored in GitHub.

### 8. GitHub secrets and variables

Repository → Settings → Secrets and variables → Actions (or put them on the
`production` environment):

| Name | Kind | Required | Value |
|------|------|----------|-------|
| `DEPLOY_HOST` | secret | yes | Server IP or SSH hostname |
| `DEPLOY_USER` | secret | yes | `deploy` |
| `DEPLOY_SSH_KEY` | secret | yes | Contents of `shravan_deploy_key` (private key) |
| `DEPLOY_KNOWN_HOSTS` | secret | yes | Output of `ssh-keyscan -p <port> <host>` |
| `DEPLOY_PORT` | secret or variable | no | SSH port, default `22` |
| `DEPLOY_PATH` | secret or variable | no | Default `/var/www/shravan-backend` |
| `DEPLOY_HEALTHCHECK_URL` | secret or variable | no | Checked on the server. Default `http://127.0.0.1:<PORT>/api/v1/health` |
| `PUBLIC_HEALTHCHECK_URL` | secret or variable | no | e.g. `https://api.shravanprovision.com/api/v1/health`, checked from GitHub after the deploy |
| `DEPLOY_PATH_DEV` | secret or variable | for `develop` | Development instance directory, e.g. `/home/ubuntu/shravan-backend-dev`. Must differ from `DEPLOY_PATH`; no default |
| `DEPLOY_HEALTHCHECK_URL_DEV` | secret or variable | no | Like `DEPLOY_HEALTHCHECK_URL`, for development (default uses `PORT` from its `shared/.env`) |
| `PUBLIC_HEALTHCHECK_URL_DEV` | secret or variable | no | e.g. `https://dev-api.shravanprovision.com/api/v1/health` |

The development target uses the same `DEPLOY_HOST`, `DEPLOY_USER`,
`DEPLOY_SSH_KEY`, `DEPLOY_KNOWN_HOSTS` and `DEPLOY_PORT`.

If Cloudflare's bot protection challenges GitHub's runners, the public check
fails (the deploy itself is fine); leave `PUBLIC_HEALTHCHECK_URL` unset or add
a WAF skip rule for `/api/v1/health`.

### 9. `production` environment (optional protection)

Settings → Environments → `production` (created automatically on the first
run): add **Required reviewers** to approve each deploy, and restrict
**Deployment branches** to `main`. Deploys queue one at a time
(`deploy-backend-production` concurrency group).

## Migrating from the current manual PM2 setup

1. Find the old process: `pm2 ls` (as the user that runs it). Note its name,
   port and where its `.env` lives.
2. Copy that `.env` to `/var/www/shravan-backend/shared/.env` (chmod 600, owner
   `deploy`) and review it against the table above.
3. If the old process runs under the same `deploy` user and port 3000, stop it
   right before the first deploy: `pm2 stop <old-name>`. The deploy script
   refuses a first deploy while something already answers the health URL,
   because the check would otherwise pass against the old process. Expect
   one to two minutes of downtime, once.
   (Zero-downtime alternative: set `PORT=3001` in `shared/.env`, deploy, point
   nginx's upstream at 3001, reload nginx, then stop the old process.)
4. Trigger the deploy: Actions → Deploy backend → Run workflow (branch `main`).
5. After it succeeds: `pm2 delete <old-name> && pm2 save`. If the old process
   ran under another user, also run `pm2 unstartup` for that user so it does
   not come back on reboot. Keep the old directory and `.env` until you are
   confident, then remove them.

## Development environment

A second instance of the backend runs on the same server for testing. It has
its own directory, PM2 app, port, Redis database and config, and is deployed
from the `develop` branch.

| | Production | Development |
|---|---|---|
| Branch | `main` | `develop` |
| GitHub environment / concurrency group | `production` / `deploy-backend-production` | `development` / `deploy-backend-development` |
| `DEPLOY_PATH` | `DEPLOY_PATH` (default `/var/www/shravan-backend`) | `DEPLOY_PATH_DEV`, e.g. `/home/ubuntu/shravan-backend-dev` |
| PM2 app (`APP_NAME`) | `shravan-backend` | `shravan-backend-dev` |
| Public URL | `api.shravanprovision.com` | own subdomain / tunnel, e.g. `dev-api.shravanprovision.com` |

Differences in the development `shared/.env` (start from a copy of the
production file, then change these):

| Variable | Development value | Why |
|----------|-------------------|-----|
| `NODE_ENV` | `development` | Enables the fixed OTP; PM2 runs the app as development |
| `PORT` | `3001` | Production uses 3000. The deploy health check reads `PORT` from `shared/.env` |
| `REDIS_DB` | `1` | Production uses `0`. Sessions, OTP codes, caches and BullMQ queues are keyed per database, so a different index keeps them apart on a shared Redis server. **Never give both instances the same `REDIS_DB`**: dev would consume production jobs and could read production sessions |
| `MONGODB_DB` | `shravankirana` | Development database. It must not be the database production uses on the same MongoDB server |
| `OTP_FIXED_CODE` | `000000` | Every phone number logs in with this code, no SMS is sent (no 2Factor cost). Must have exactly `OTP_LENGTH` digits. The backend refuses to start if this is set with `NODE_ENV=production` |
| `OTP_LENGTH` | `6` | The apps render as many boxes as the server reports |
| `PAYU_ENV` | `test` | PayU sandbox with test keys, never live keys |
| `PUBLIC_API_URL`, `PAYMENT_RETURN_URL`, `CORS_ORIGINS`, `SOCKET_IO_CORS_ORIGIN` | the dev subdomain | Callbacks and browsers must reach the dev instance, not production |
| `JWT_SECRET`, `JWT_REFRESH_SECRET` | new values | Different from production, so tokens never work across instances |

At startup the development instance logs `Fixed OTP mode enabled — SMS
disabled`. If you do not see it, the fixed OTP is not active.

One-time setup on the server (as the deploy user, e.g. `ubuntu`):

```bash
mkdir -p /home/ubuntu/shravan-backend-dev/{releases,shared/logs,incoming}
install -m 600 /dev/null /home/ubuntu/shravan-backend-dev/shared/.env
nano /home/ubuntu/shravan-backend-dev/shared/.env     # values above
```

Then set `DEPLOY_PATH_DEV` in GitHub, give the dev subdomain its own nginx
`server` block (or tunnel) pointing at `127.0.0.1:3001`, and push to `develop`
(or Actions → Deploy backend → Run workflow → target `development`).

Safety checks in `remote-deploy.sh`: an `APP_NAME` other than
`shravan-backend` needs an explicit `DEPLOY_PATH`, and each `DEPLOY_PATH`
records its owner in `APP_NAME`, so a deploy with the wrong name/path pair is
refused before anything changes. Deploy locks are per `DEPLOY_PATH`, so
production and development deploys never wait on each other.

Manual commands for the dev instance take the same form with its own path and
name:

```bash
DEPLOY_PATH=/home/ubuntu/shravan-backend-dev APP_NAME=shravan-backend-dev \
  bash /home/ubuntu/shravan-backend-dev/current/scripts/deploy/remote-deploy.sh rollback
pm2 logs shravan-backend-dev --lines 200
curl -s http://127.0.0.1:3001/api/v1/health
```

## Day-to-day

**Deploy**: merge to `main` (any change under `backend/`); merging to
`develop` deploys the development instance. Or run the workflow manually with a
`target` (`production` or `development`) and an optional `ref` (branch, tag or SHA). Only people with write
access can run it; add required reviewers on `production` to gate it.

**What happens on failure**: if the new release does not pass the health check
(`GET /api/v1/health` returns 200 only when MongoDB is connected) within
30 × 2 s, the script switches `current` back to the previous release, reloads
PM2, checks health again, prints the last 100 log lines and exits non-zero, so
the workflow fails. Failures before the switch (archive, `npm ci`, Node version)
leave the live release untouched.

**Roll back** to the previous release (the one before `current`):

- GitHub: Actions → Deploy backend → Run workflow → choose the `target` and tick `rollback`.
- On the server:
  ```bash
  sudo -iu deploy
  bash /var/www/shravan-backend/current/scripts/deploy/remote-deploy.sh rollback
  ```

Rolling back again goes one release further back. The next normal deploy
moves forward again.

**Status and logs** (as `deploy`):

```bash
source ~/.nvm/nvm.sh                          # if pm2/node are not on PATH
cat /var/www/shravan-backend/DEPLOYED_SHA      # live commit
ls -l /var/www/shravan-backend/current
pm2 ls
pm2 logs shravan-backend --lines 200          # or tail -f shared/logs/*.log
pm2 monit
curl -s http://127.0.0.1:3000/api/v1/health
```

**One-off scripts** run from the live release with the shared `.env`:

```bash
cd /var/www/shravan-backend/current
node --env-file=.env scripts/normalize-product-images.js          # dry run
node --env-file=.env create-admin.js
```

## Scaling

PM2 runs one instance in cluster mode by default (cluster mode still gives
zero-downtime reloads). Do not raise `PM2_INSTANCES` yet: the `/orders`
Socket.IO namespace has no Redis adapter, and clients fall back to HTTP
long-polling, which needs sticky sessions that PM2 cluster mode does not
provide. Before scaling, add the Redis adapter to every gateway and make the
clients use `transports: ['websocket']`. Changing `PM2_INSTANCES` or other
`ecosystem.config.js` settings takes effect after `pm2 delete shravan-backend`
followed by a deploy (a reload keeps the existing process settings).
