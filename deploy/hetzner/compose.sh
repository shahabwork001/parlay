#!/bin/sh
set -eu
cd "$(dirname "$0")/../.."
exec docker compose --project-name parley-preview --env-file .env \
  -f docker-compose.yml -f docker-compose.production.yml \
  -f deploy/hetzner/compose.override.yml "$@"
