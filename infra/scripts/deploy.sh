#!/usr/bin/env bash
# Production deploy: pull source, rebuild containers, run migrations,
# restart web + worker. See spec §11.6.
set -euo pipefail

REPO_DIR="${REPO_DIR:-/opt/getnextbike}"
ENV_FILE="${ENV_FILE:-/etc/getnextbike/.env}"

cd "$REPO_DIR"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "missing $ENV_FILE — bail before doing anything destructive" >&2
  exit 1
fi

echo "==> git pull"
git pull --ff-only

echo "==> docker compose build"
docker compose -f infra/compose.yaml build

echo "==> docker compose up -d"
docker compose -f infra/compose.yaml up -d --remove-orphans

echo "==> docker image prune (dangling layers from prior builds)"
docker image prune -f

echo "==> done"
