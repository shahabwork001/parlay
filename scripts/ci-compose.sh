#!/bin/sh
set -eu
cd "$(dirname "$0")/.."
# CI-only placeholders, never overwrite a developer's existing runtime configuration.
test -e backend/.env || cp backend/.env.example backend/.env
test -e frontend/.env || cp frontend/.env.example frontend/.env
docker compose --env-file backend/.env -f docker-compose.yml -f docker-compose.production.yml config --quiet
# Validate exact-image overlay against the existing Hetzner topology as well.
TURN_EXTERNAL_IP=127.0.0.1 docker compose --env-file backend/.env \
  -f docker-compose.yml -f docker-compose.production.yml \
  -f deploy/hetzner/compose.override.yml config --quiet
