#!/usr/bin/env bash
# Seeds the running stack (first SuperAdmin) and prints its generated password once.
# Run from anywhere after `docker compose up`. Idempotent.
set -euo pipefail
cd "$(dirname "$0")/.."
docker compose run --rm --no-deps -e SEED_PRINT_CREDENTIALS=true api node dist/tools/seed.js
