#!/usr/bin/env bash
set -Eeuo pipefail

SERVICE_NAME="localloop-web.service"
HEALTH_URL="http://127.0.0.1:3000/api/health"

log() {
  printf '[deploy] %s\n' "$1"
}

require_repo_root() {
  if [[ ! -f "package.json" || ! -f "pnpm-workspace.yaml" || ! -d "apps/web" ]]; then
    printf 'deploy-homelab.sh must be run from the LocalLoop repo root.\n' >&2
    exit 1
  fi
}

require_clean_worktree() {
  if [[ -n "$(git status --porcelain)" ]]; then
    printf 'Working tree has uncommitted changes; commit or stash them before deploying.\n' >&2
    git status --short >&2
    exit 1
  fi
}

load_env() {
  if [[ ! -f ".env" ]]; then
    printf '.env missing; create it before deploying.\n' >&2
    exit 1
  fi

  set -a
  # shellcheck disable=SC1091
  source .env
  set +a

  if [[ -z "${DATABASE_URL:-}" ]]; then
    printf 'DATABASE_URL missing in .env.\n' >&2
    exit 1
  fi
}

main() {
  require_repo_root
  require_clean_worktree

  log "Pulling latest commits with git pull --ff-only."
  git pull --ff-only

  log "Installing dependencies."
  pnpm install --frozen-lockfile

  log "Loading deployment environment."
  load_env

  log "Running database migrations."
  pnpm db:migrate

  log "Building workspace."
  pnpm build

  log "Restarting ${SERVICE_NAME}; sudo may prompt for your password."
  sudo systemctl restart "${SERVICE_NAME}"

  log "Smoke checking ${HEALTH_URL}."
  curl -fsS "${HEALTH_URL}" >/dev/null

  log "Deploy complete: dependencies installed, migrations applied, web service restarted, health check passed."
}

main "$@"
