#!/usr/bin/env bash
set -Eeuo pipefail

SERVICE_NAME="localloop-web.service"
HEALTH_URL="http://127.0.0.1:3000/api/health"

log() {
  printf '[restart-web] %s\n' "$1"
}

if [[ ! -f "package.json" || ! -f "pnpm-workspace.yaml" || ! -d "apps/web" ]]; then
  printf 'restart-homelab-web.sh must be run from the LocalLoop repo root.\n' >&2
  exit 1
fi

log "Building current checkout."
pnpm build

log "Restarting ${SERVICE_NAME}; sudo may prompt for your password."
sudo systemctl restart "${SERVICE_NAME}"

log "Smoke checking ${HEALTH_URL}."
curl -fsS "${HEALTH_URL}" >/dev/null

log "Web service restarted and health check passed."
