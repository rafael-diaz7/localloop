#!/usr/bin/env bash
set -Eeuo pipefail

SERVICE_NAME="localloop-web.service"
HEALTH_URL="http://127.0.0.1:3000/api/health"
HEALTH_INITIAL_DELAY_SECONDS="${HEALTH_INITIAL_DELAY_SECONDS:-5}"
HEALTH_CHECK_TIMEOUT_SECONDS="${HEALTH_CHECK_TIMEOUT_SECONDS:-60}"
HEALTH_CHECK_INTERVAL_SECONDS="${HEALTH_CHECK_INTERVAL_SECONDS:-2}"

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

wait_for_health() {
  local deadline
  local now

  log "Waiting ${HEALTH_INITIAL_DELAY_SECONDS}s before health check."
  sleep "${HEALTH_INITIAL_DELAY_SECONDS}"

  deadline=$((SECONDS + HEALTH_CHECK_TIMEOUT_SECONDS))

  until curl -fsS "${HEALTH_URL}" >/dev/null 2>&1; do
    now="${SECONDS}"

    if (( now >= deadline )); then
      printf 'Health check failed after %ss: %s\n' "${HEALTH_CHECK_TIMEOUT_SECONDS}" "${HEALTH_URL}" >&2
      return 1
    fi

    log "Health check not ready; retrying in ${HEALTH_CHECK_INTERVAL_SECONDS}s."
    sleep "${HEALTH_CHECK_INTERVAL_SECONDS}"
  done
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
  wait_for_health

  log "Deploy complete: dependencies installed, migrations applied, web service restarted, health check passed."
}

main "$@"
