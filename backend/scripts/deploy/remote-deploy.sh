#!/usr/bin/env bash
# Deploys or rolls back the backend on the server. Runs ON the server as the
# deploy user (called over SSH by .github/workflows/deploy-backend.yml).
# Production and the development instance are separate targets on the same
# server: each has its own DEPLOY_PATH, APP_NAME (PM2 app) and shared/.env.
#
# Usage:
#   remote-deploy.sh deploy <release.tar.gz> <git-sha>
#   remote-deploy.sh rollback
#
# Layout under $DEPLOY_PATH:
#   releases/<UTC timestamp>-<sha>/   one directory per release (newest 5 kept)
#   shared/.env                       this target's config, linked into every release
#   shared/logs/                      PM2 log files
#   current -> releases/<release>     the live release
#   DEPLOYED_SHA                      commit of the live release
#   APP_NAME                          PM2 app that owns this DEPLOY_PATH (written on deploy)
#
# Optional environment:
#   DEPLOY_PATH           default /var/www/shravan-backend
#   HEALTHCHECK_URL       default http://127.0.0.1:<PORT from shared/.env, else 3000>/api/v1/health
#   APP_NAME              PM2 app name, default shravan-backend (production).
#                         The development target uses e.g. shravan-backend-dev.
#                         Exported to ecosystem.config.js as PM2_APP_NAME.
#                         (PM2_APP_NAME is accepted as an older alias.)
#   KEEP_RELEASES         default 5
#   HEALTHCHECK_ATTEMPTS  default 30
#   HEALTHCHECK_INTERVAL  default 2 (seconds)
#   LOCK_TIMEOUT          default 600 (seconds to wait for a running deploy)
set -euo pipefail

DEPLOY_PATH_WAS_SET="${DEPLOY_PATH:+yes}"
DEPLOY_PATH="${DEPLOY_PATH:-/var/www/shravan-backend}"
DEPLOY_PATH="${DEPLOY_PATH%/}"
export DEPLOY_PATH
APP_NAME="${APP_NAME:-${PM2_APP_NAME:-shravan-backend}}"
[[ "$APP_NAME" =~ ^[A-Za-z0-9._-]+$ ]] || {
  printf '[deploy] ERROR: invalid APP_NAME: %s\n' "$APP_NAME" >&2
  exit 1
}
# The default DEPLOY_PATH is production's; any other app must name its own.
if [[ "$APP_NAME" != shravan-backend && -z "$DEPLOY_PATH_WAS_SET" ]]; then
  printf '[deploy] ERROR: APP_NAME=%s needs an explicit DEPLOY_PATH\n' "$APP_NAME" >&2
  exit 1
fi
# ecosystem.config.js names the PM2 app from this.
PM2_APP_NAME="$APP_NAME"
export PM2_APP_NAME
KEEP_RELEASES="${KEEP_RELEASES:-5}"
HEALTHCHECK_ATTEMPTS="${HEALTHCHECK_ATTEMPTS:-30}"
HEALTHCHECK_INTERVAL="${HEALTHCHECK_INTERVAL:-2}"
LOCK_TIMEOUT="${LOCK_TIMEOUT:-600}"

RELEASES_DIR="$DEPLOY_PATH/releases"
SHARED_DIR="$DEPLOY_PATH/shared"
CURRENT_LINK="$DEPLOY_PATH/current"
APP_NAME_FILE="$DEPLOY_PATH/APP_NAME"

# Set while a new release directory is being prepared; removed if we exit early.
PREPARING_DIR=""

log() { printf '[deploy %s] %s\n' "$(date -u +%H:%M:%S)" "$*"; }
die() {
  printf '[deploy] ERROR: %s\n' "$*" >&2
  exit 1
}

usage() {
  cat >&2 <<'EOF'
Usage:
  remote-deploy.sh deploy <release.tar.gz> <git-sha>
  remote-deploy.sh rollback
EOF
  exit 2
}

on_exit() {
  local rc=$?
  if [[ $rc -ne 0 && -n "$PREPARING_DIR" ]]; then
    log "Removing incomplete release $PREPARING_DIR (live release untouched)"
    rm -rf "$PREPARING_DIR"
  fi
}
trap on_exit EXIT

# Value of KEY in shared/.env (last occurrence, quotes stripped), or empty.
env_value() {
  local key="$1" file="$SHARED_DIR/.env" line
  [[ -f "$file" ]] || return 0
  line="$(grep -E "^[[:space:]]*(export[[:space:]]+)?${key}=" "$file" | tail -n 1 || true)"
  line="${line#*=}"
  line="${line%$'\r'}"
  line="${line%\"}"
  line="${line#\"}"
  line="${line%\'}"
  line="${line#\'}"
  printf '%s' "$line"
}

acquire_lock() {
  command -v flock >/dev/null 2>&1 || die "flock not found (install util-linux)"
  mkdir -p "$DEPLOY_PATH"
  exec 9>"$DEPLOY_PATH/.deploy.lock"
  if ! flock -w "$LOCK_TIMEOUT" 9; then
    die "another deploy is still running (waited ${LOCK_TIMEOUT}s)"
  fi
}

# Name of the release `current` points at, or empty.
current_release() {
  if [[ -L "$CURRENT_LINK" ]]; then
    basename "$(readlink "$CURRENT_LINK")"
  fi
}

# Newest release older than $1, or empty.
previous_release() {
  local cur="$1" name prev=""
  while IFS= read -r name; do
    if [[ "$name" < "$cur" ]]; then
      prev="$name"
    fi
  done < <(find "$RELEASES_DIR" -mindepth 1 -maxdepth 1 -type d -printf '%f\n' | sort)
  printf '%s' "$prev"
}

# Atomically point `current` at releases/$1.
switch_to() {
  local name="$1"
  ln -sfn "releases/$name" "$DEPLOY_PATH/.current.tmp"
  mv -Tf "$DEPLOY_PATH/.current.tmp" "$CURRENT_LINK"
  log "current -> releases/$name"
}

# Put the Node version from the release's .nvmrc on PATH (via nvm when
# installed) and make sure its major version matches.
use_node() {
  local dir="$1" want="" have
  if [[ -f "$dir/.nvmrc" ]]; then
    want="$(tr -d '[:space:]' <"$dir/.nvmrc")"
    want="${want#v}"
  fi

  export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
  if [[ -s "$NVM_DIR/nvm.sh" ]]; then
    # nvm is not written for `set -eu`.
    set +eu
    # shellcheck source=/dev/null
    . "$NVM_DIR/nvm.sh"
    if [[ -n "$want" ]]; then
      nvm use --silent "$want" >/dev/null
    else
      nvm use --silent default >/dev/null
    fi
    local rc=$?
    set -eu
    [[ $rc -eq 0 ]] || die "Node $want is not installed via nvm. Run: nvm install $want (then reinstall pm2 for it, see docs/DEPLOYMENT.md)"
  fi

  command -v node >/dev/null 2>&1 || die "node not found in PATH"
  have="$(node -p 'process.versions.node')"
  if [[ -n "$want" && "${have%%.*}" != "${want%%.*}" ]]; then
    die "release needs Node ${want} (.nvmrc) but the server runs Node ${have}"
  fi
  command -v npm >/dev/null 2>&1 || die "npm not found in PATH"
  command -v pm2 >/dev/null 2>&1 || die "pm2 not found for Node ${have}. Run: npm install -g pm2"
  log "Using Node ${have}"
}

pm2_reload() {
  # PM2_INSTANCES may be set in shared/.env; ecosystem.config.js reads it.
  local instances
  instances="$(env_value PM2_INSTANCES)"
  if [[ -n "$instances" && -z "${PM2_INSTANCES:-}" ]]; then
    export PM2_INSTANCES="$instances"
  fi
  # NODE_ENV from this target's shared/.env (ecosystem.config.js falls back to
  # production for anything other than "development").
  DEPLOY_NODE_ENV="$(env_value NODE_ENV)"
  export DEPLOY_NODE_ENV
  log "PM2 app $PM2_APP_NAME (NODE_ENV=$([[ "$DEPLOY_NODE_ENV" == development ]] && echo development || echo production))"
  (cd "$CURRENT_LINK" && pm2 startOrReload ecosystem.config.js --env production --update-env) || return 1
  pm2 save || return 1
}

health_check() {
  local i
  log "Health check: $HEALTHCHECK_URL (${HEALTHCHECK_ATTEMPTS} x ${HEALTHCHECK_INTERVAL}s)"
  for ((i = 1; i <= HEALTHCHECK_ATTEMPTS; i++)); do
    if curl -fsS --max-time 5 -o /dev/null "$HEALTHCHECK_URL" 2>/dev/null; then
      log "Healthy after $i attempt(s)"
      return 0
    fi
    sleep "$HEALTHCHECK_INTERVAL"
  done
  log "Still unhealthy after ${HEALTHCHECK_ATTEMPTS} attempts"
  return 1
}

show_logs() {
  log "Last 100 PM2 log lines for $PM2_APP_NAME:"
  pm2 logs "$PM2_APP_NAME" --nostream --lines 100 || true
}

write_deployed_sha() {
  local name="$1" sha=""
  if [[ -f "$RELEASES_DIR/$name/REVISION" ]]; then
    sha="$(tr -d '[:space:]' <"$RELEASES_DIR/$name/REVISION")"
  fi
  [[ -n "$sha" ]] || sha="${name#*-}"
  printf '%s\n' "$sha" >"$DEPLOY_PATH/DEPLOYED_SHA.tmp"
  mv -f "$DEPLOY_PATH/DEPLOYED_SHA.tmp" "$DEPLOY_PATH/DEPLOYED_SHA"
}

# Keep the newest $KEEP_RELEASES releases, and always the live one.
prune_releases() {
  local cur name count=0
  cur="$(current_release)"
  while IFS= read -r name; do
    count=$((count + 1))
    if ((count > KEEP_RELEASES)) && [[ "$name" != "$cur" ]]; then
      log "Pruning old release $name"
      rm -rf "${RELEASES_DIR:?}/$name"
    fi
  done < <(find "$RELEASES_DIR" -mindepth 1 -maxdepth 1 -type d -printf '%f\n' | sort -r)
}

# One DEPLOY_PATH belongs to exactly one PM2 app. Stops a development deploy
# from replacing the production release (or the reverse) through a wrong
# DEPLOY_PATH/APP_NAME pair.
check_app_name() {
  local owner
  if [[ -f "$APP_NAME_FILE" ]]; then
    owner="$(tr -d '[:space:]' <"$APP_NAME_FILE")"
    [[ "$owner" == "$APP_NAME" ]] ||
      die "$DEPLOY_PATH belongs to PM2 app '$owner', not '$APP_NAME'. Check DEPLOY_PATH and APP_NAME."
  else
    printf '%s\n' "$APP_NAME" >"$APP_NAME_FILE"
  fi
}

check_layout() {
  if [[ -e "$CURRENT_LINK" && ! -L "$CURRENT_LINK" ]]; then
    die "$CURRENT_LINK exists but is not a symlink; move it away first (see docs/DEPLOYMENT.md)"
  fi
  [[ -f "$SHARED_DIR/.env" ]] || die "missing $SHARED_DIR/.env (see docs/DEPLOYMENT.md)"
  mkdir -p "$RELEASES_DIR" "$SHARED_DIR/logs"
  check_app_name
}

resolve_healthcheck_url() {
  if [[ -z "${HEALTHCHECK_URL:-}" ]]; then
    local port
    port="$(env_value PORT)"
    HEALTHCHECK_URL="http://127.0.0.1:${port:-3000}/api/v1/health"
  fi
  command -v curl >/dev/null 2>&1 || die "curl not found"
}

deploy() {
  local tarball="$1" sha="$2" name dir prev
  [[ -f "$tarball" ]] || die "release archive not found: $tarball"
  [[ "$sha" =~ ^[0-9a-f]{7,40}$ ]] || die "invalid git sha: $sha"
  check_layout
  resolve_healthcheck_url

  prev="$(current_release)"
  if [[ -n "$prev" && ! -d "$RELEASES_DIR/$prev" ]]; then
    log "WARNING: current points at missing release $prev; treating as first deploy"
    prev=""
  fi
  if [[ -z "$prev" ]] && curl -fsS --max-time 5 -o /dev/null "$HEALTHCHECK_URL" 2>/dev/null; then
    die "first deploy, but something already answers $HEALTHCHECK_URL. Stop the old process first (see docs/DEPLOYMENT.md, 'Migrating')."
  fi

  name="$(date -u +%Y%m%d%H%M%S)-${sha:0:12}"
  dir="$RELEASES_DIR/$name"
  [[ ! -e "$dir" ]] || die "release directory already exists: $dir"
  log "Preparing release $name (previous: ${prev:-none})"

  PREPARING_DIR="$dir"
  mkdir -p "$dir"
  tar -xzf "$tarball" -C "$dir"
  [[ -f "$dir/dist/main.js" && -f "$dir/package-lock.json" && -f "$dir/ecosystem.config.js" ]] ||
    die "release archive is missing dist/main.js, package-lock.json or ecosystem.config.js"
  printf '%s\n' "$sha" >"$dir/REVISION"
  ln -sfn "$SHARED_DIR/.env" "$dir/.env"

  use_node "$dir"
  log "Installing production dependencies"
  (cd "$dir" && npm ci --omit=dev --no-audit --no-fund)

  # From here on, failures are handled by rolling back instead of the exit trap.
  PREPARING_DIR=""
  switch_to "$name"

  if pm2_reload && health_check; then
    write_deployed_sha "$name"
    prune_releases
    log "Deployed $sha ($name)"
    return 0
  fi

  log "New release $name is unhealthy"
  show_logs

  if [[ -z "$prev" ]]; then
    log "First deploy: no previous release to roll back to; stopping $PM2_APP_NAME"
    pm2 delete "$PM2_APP_NAME" >/dev/null 2>&1 || true
    pm2 save || true
    rm -f "$CURRENT_LINK"
    rm -rf "${RELEASES_DIR:?}/$name"
    die "deploy of $sha failed"
  fi

  log "Rolling back to $prev"
  use_node "$RELEASES_DIR/$prev"
  switch_to "$prev"
  if pm2_reload && health_check; then
    log "Rollback to $prev is healthy"
  else
    log "Rollback to $prev is ALSO unhealthy; check the server (Mongo, Redis, shared/.env)"
    show_logs
  fi
  rm -rf "${RELEASES_DIR:?}/$name"
  die "deploy of $sha failed and was rolled back to $prev"
}

rollback() {
  local cur prev
  check_layout
  resolve_healthcheck_url

  cur="$(current_release)"
  [[ -n "$cur" ]] || die "no current release to roll back from"
  prev="$(previous_release "$cur")"
  [[ -n "$prev" ]] || die "no release older than $cur to roll back to"
  log "Rolling back $cur -> $prev"

  use_node "$RELEASES_DIR/$prev"
  switch_to "$prev"
  if pm2_reload && health_check; then
    write_deployed_sha "$prev"
    log "Rolled back to $prev ($(cat "$DEPLOY_PATH/DEPLOYED_SHA"))"
    return 0
  fi

  log "Release $prev is unhealthy; switching back to $cur"
  show_logs
  use_node "$RELEASES_DIR/$cur"
  switch_to "$cur"
  if pm2_reload && health_check; then
    log "Back on $cur (healthy)"
  else
    log "$cur is also unhealthy; check the server (Mongo, Redis, shared/.env)"
  fi
  die "rollback to $prev failed"
}

main() {
  local mode="${1:-}"
  case "$mode" in
  deploy)
    [[ $# -eq 3 ]] || usage
    acquire_lock
    deploy "$2" "$3"
    ;;
  rollback)
    [[ $# -eq 1 ]] || usage
    acquire_lock
    rollback
    ;;
  *) usage ;;
  esac
}

main "$@"
