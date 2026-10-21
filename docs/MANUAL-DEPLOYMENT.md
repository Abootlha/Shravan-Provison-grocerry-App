# ShravanKirana Backend — Manual Deployment & CI/CD Guide

> **Lesson learned (Oct 17, 2026):** Manually copying `dist` to `current/` without
> the `.env` symlink and `npm ci` caused a production outage (502 Bad Gateway).
> Always follow this guide or use CI/CD.

---

## Table of Contents
1. [CI/CD (Automatic) — Recommended](#1-cicd-automatic--recommended)
2. [Manual Deployment — Step by Step](#2-manual-deployment--step-by-step)
3. [Emergency Hotfix (No CI/CD)](#3-emergency-hotfix-no-cicd)
4. [Common Pitfalls](#4-common-pitfalls)
5. [Troubleshooting](#5-troubleshooting)
6. [GitHub Secrets Checklist](#6-github-secrets-checklist)

---

## 1. CI/CD (Automatic) — Recommended

### How it works
```
Push to main/develop
  └─ GitHub Actions (deploy-backend.yml)
       ├─ Verify: npm ci → eslint → tsc → jest → build → package release.tar.gz
       └─ Deploy: scp to server → remote-deploy.sh
            ├─ Extract to releases/<timestamp>-<sha>/
            ├─ Symlink .env → shared/.env
            ├─ npm ci --omit=dev
            ├─ Switch current → new release
            ├─ pm2 reload
            ├─ Health check (30 attempts × 2s)
            └─ Success → prune old releases
               Failure → auto-rollback to previous release
```

### Trigger deployment

**Option A — Push to branch:**
```bash
# Production
git push origin main

# Development
git push origin develop
```
Only changes under `backend/` or `.github/workflows/deploy-backend.yml` trigger the deploy.

**Option B — Manual trigger:**
1. Go to GitHub → **Actions** → **Deploy backend**
2. Click **Run workflow**
3. Select target: `production` or `development`
4. Optionally specify a git ref (branch/tag/SHA)
5. Tick `rollback` to go back to the previous release

### Rollback via CI/CD
1. GitHub → Actions → Deploy backend → Run workflow
2. Select target → tick **rollback** → Run

---

## 2. Manual Deployment — Step by Step

> ⚠️ **Only use manual deployment when CI/CD is broken or unavailable.**
> CI/CD is safer — it builds, tests, deploys, and auto-rolls-back on failure.

### Prerequisites
- SSH access to the server
- Node.js installed locally (same major version as `.nvmrc`)
- Access to the Git repository

### Step 1: Build locally
```bash
cd ~/Desktop/ShravanKirana/backend

# Install dependencies
npm ci

# Run checks (optional but recommended)
npx eslint "{src,apps,libs,test}/**/*.ts"
npx tsc --noEmit

# Build
npm run build

# Verify dist exists
ls dist/main.js
```

### Step 2: Package the release
```bash
cd ~/Desktop/ShravanKirana/backend

# Create the release archive (same as CI/CD does)
tar -czf /tmp/release.tar.gz \
  dist package.json package-lock.json .nvmrc \
  ecosystem.config.js scripts create-admin.js
```

### Step 3: Upload to server
```bash
# Replace <server-ip> with your actual server IP
scp /tmp/release.tar.gz ubuntu@<server-ip>:~/shravan-backend/incoming/
```

### Step 4: Deploy on server (SSH)
```bash
ssh ubuntu@<server-ip>

# --- On the server ---

# Set variables (production)
DEPLOY_PATH=~/shravan-backend
APP_NAME=shravan-backend

# OR for development:
# DEPLOY_PATH=~/shravan-backend-dev
# APP_NAME=shravan-backend-dev

# Create release directory
RELEASE_NAME=$(date -u +%Y%m%d%H%M%S)-manual
mkdir -p $DEPLOY_PATH/releases/$RELEASE_NAME

# Extract release
tar -xzf $DEPLOY_PATH/incoming/release.tar.gz -C $DEPLOY_PATH/releases/$RELEASE_NAME

# ⚠️ CRITICAL: Create .env symlink
ln -sfn $DEPLOY_PATH/shared/.env $DEPLOY_PATH/releases/$RELEASE_NAME/.env

# Verify symlink
ls -la $DEPLOY_PATH/releases/$RELEASE_NAME/.env
# Should show: .env -> /home/ubuntu/shravan-backend/shared/.env

# Install production dependencies
cd $DEPLOY_PATH/releases/$RELEASE_NAME
npm ci --omit=dev

# Switch current to new release (atomic symlink swap)
ln -sfn releases/$RELEASE_NAME $DEPLOY_PATH/.current.tmp
mv -Tf $DEPLOY_PATH/.current.tmp $DEPLOY_PATH/current

# Verify current points to new release
ls -la $DEPLOY_PATH/current

# Reload PM2
cd $DEPLOY_PATH/current
PM2_APP_NAME=$APP_NAME pm2 startOrReload ecosystem.config.js --env production --update-env
pm2 save

# Wait and health check
sleep 5
curl -s http://127.0.0.1:3000/api/v1/health
# Should return JSON with status: "ok"

# Check PM2 status
pm2 status
# pid should be non-zero, mem should show usage, restarts should be low

# Clean up
rm -f $DEPLOY_PATH/incoming/release.tar.gz
```

### Step 5: Verify
```bash
# On server: check logs
pm2 logs $APP_NAME --lines 20 --nostream

# From local: test the public URL
curl -I https://api.shravanprovision.com/api/v1/health
```

---

## 3. Emergency Hotfix (No CI/CD)

For quick fixes when you can't wait for CI/CD:

```bash
# === LOCAL ===
cd ~/Desktop/ShravanKirana/backend
npm run build

# Copy only the necessary files
scp -r dist package.json package-lock.json ubuntu@<server-ip>:/tmp/hotfix/

# === SERVER (SSH) ===
ssh ubuntu@<server-ip>

# Backup current dist
cp -r ~/shravan-backend/current/dist ~/shravan-backend/current/dist.bak

# Copy new files
cp -r /tmp/hotfix/dist ~/shravan-backend/current/
cp /tmp/hotfix/package.json ~/shravan-backend/current/
cp /tmp/hotfix/package-lock.json ~/shravan-backend/current/

# ⚠️ ALWAYS run npm ci after updating package files
cd ~/shravan-backend/current
npm ci --omit=dev

# ⚠️ ALWAYS verify .env symlink exists
ls -la .env
# Must show: .env -> ../shared/.env (or full path)
# If missing: ln -sfn ~/shravan-backend/shared/.env .env

# Restart
pm2 restart shravan-backend --update-env

# Verify
sleep 5
curl -s http://127.0.0.1:3000/api/v1/health
pm2 status

# If broken, restore backup:
# cp -r ~/shravan-backend/current/dist.bak ~/shravan-backend/current/dist
# pm2 restart shravan-backend --update-env
```

---

## 4. Common Pitfalls

### ❌ DON'T: Copy only `dist` without `.env` symlink
```bash
# WRONG — causes CORS errors and crashes
cp -r dist ~/shravan-backend/current/
```
**Why:** Without `.env`, the backend starts with no config → empty `CORS_ORIGINS`,
no MongoDB URI, no JWT secrets → 502 Bad Gateway.

### ❌ DON'T: Copy `dist` without running `npm ci`
```bash
# WRONG — causes MODULE_NOT_FOUND crashes
cp -r dist ~/shravan-backend/current/
pm2 restart shravan-backend
```
**Why:** New code may import new packages (e.g. `@aws-sdk/client-s3`) that aren't
in the old `node_modules`.

### ❌ DON'T: Forget to copy `package.json` and `package-lock.json`
```bash
# WRONG — npm ci uses old lock file, missing new dependencies
cp -r dist ~/shravan-backend/current/
cd ~/shravan-backend/current && npm ci --omit=dev
```
**Why:** `npm ci` reads the existing `package-lock.json`. If new dependencies were
added, the old lock file doesn't know about them.

### ✅ DO: Always include these files together
```
dist/                   ← compiled code
package.json            ← dependency list
package-lock.json       ← exact versions
ecosystem.config.js     ← PM2 config
.env → shared/.env      ← symlink to config (NEVER copy the actual .env)
```

---

## 5. Troubleshooting

### Quick diagnostic commands (run on server)
```bash
# Overall status
pm2 status

# Recent logs
pm2 logs shravan-backend --lines 50 --nostream

# Health check
curl -s http://127.0.0.1:3000/api/v1/health

# Check .env symlink
ls -la ~/shravan-backend/current/.env

# Check what current points to
ls -la ~/shravan-backend/current

# Check Redis
redis-cli ping

# Check Cloudflare Tunnel
ps aux | grep cloudflared

# Run manually for exact errors
pm2 stop shravan-backend
cd ~/shravan-backend/current && node dist/main.js
# (Ctrl+C to stop, then pm2 start shravan-backend)
```

### Common errors and fixes

| Error | Cause | Fix |
|-------|-------|-----|
| `502 Bad Gateway` | Backend not running | Check `pm2 status`, fix crash, restart |
| `CORS policy` error | Missing/empty `CORS_ORIGINS` | Check `.env` symlink: `ls -la ~/shravan-backend/current/.env` |
| `Cannot find module 'X'` | Missing dependency | `cd current && npm ci --omit=dev` |
| `ECONNREFUSED 127.0.0.1:6379` | Redis down | `sudo systemctl start redis-server` |
| `pid: 0, mem: 0b` | Crash loop | `pm2 stop <app> && cd current && node dist/main.js` to see error |
| Backend starts but dies | Check error log | `cat ~/shravan-backend/shared/logs/error.log \| tail -50` |

---

## 6. GitHub Secrets Checklist

For CI/CD to work, set these in **GitHub → Settings → Secrets and Variables → Actions**:

### Required secrets
| Secret | Value | Example |
|--------|-------|---------|
| `DEPLOY_HOST` | Server IP (SSH, NOT Cloudflare domain) | `13.233.169.234` |
| `DEPLOY_USER` | SSH username | `ubuntu` |
| `DEPLOY_SSH_KEY` | Private SSH key (ed25519) | Contents of `shravan_deploy_key` |
| `DEPLOY_KNOWN_HOSTS` | Server host key | Output of `ssh-keyscan -p 22 <ip>` |

### Required variables (or secrets)
| Name | Value |
|------|-------|
| `DEPLOY_PATH` | `/home/ubuntu/shravan-backend` |
| `DEPLOY_PATH_DEV` | `/home/ubuntu/shravan-backend-dev` |

### Optional variables
| Name | Value |
|------|-------|
| `DEPLOY_PORT` | `22` (default) |
| `DEPLOY_HEALTHCHECK_URL` | `http://127.0.0.1:3000/api/v1/health` |
| `DEPLOY_HEALTHCHECK_URL_DEV` | `http://127.0.0.1:3001/api/v1/health` |
| `PUBLIC_HEALTHCHECK_URL` | `https://api.shravanprovision.com/api/v1/health` |

### How to create SSH deploy key
```bash
# On your local machine
ssh-keygen -t ed25519 -C "github-actions-deploy" -f shravan_deploy_key -N ""

# Copy public key to server
ssh-copy-id -i shravan_deploy_key.pub ubuntu@<server-ip>

# Test
ssh -i shravan_deploy_key ubuntu@<server-ip> 'pm2 status'

# Get known hosts (for DEPLOY_KNOWN_HOSTS secret)
ssh-keyscan -p 22 <server-ip>

# Add private key as DEPLOY_SSH_KEY secret in GitHub
cat shravan_deploy_key
# Copy the output → GitHub Secrets → DEPLOY_SSH_KEY

# Delete local private key after adding to GitHub
rm shravan_deploy_key
```

### Verify CI/CD is working
After setting secrets:
1. Make a small change in `backend/` (e.g., add a comment)
2. Push to `main`
3. Go to GitHub → Actions → watch "Deploy backend" workflow
4. It should: build → test → deploy → health check → ✅

---

## Server Info (for reference)

| Item | Value |
|------|-------|
| EC2 Instance | `i-071c5dff7af6bcd11` (testing-backend) |
| Region | `ap-south-1` (Mumbai) |
| Public IP | `13.233.169.234` |
| Private IP | `172.31.0.253` |
| SSH User | `ubuntu` |
| Production path | `~/shravan-backend` |
| Dev path | `~/shravan-backend-dev` |
| Production port | `3000` |
| Dev port | `3001` |
| PM2 apps | `shravan-backend`, `shravan-backend-dev` |
| Domain | `api.shravanprovision.com` → Cloudflare Tunnel → `localhost:3000` |
| Node version | `22` (`.nvmrc`) |
