#!/usr/bin/env bash
# One-command local setup: generates env files (first run only), then builds and starts the full stack.
set -euo pipefail
cd "$(dirname "$0")/.."

./backend/scripts/init-env.sh
./frontend/scripts/init-env.sh
docker compose up -d --build --wait
./backend/scripts/seed.sh

cat <<INFO

Parley is running:
  Frontend          http://localhost:3000
  API               http://localhost:8080   (health: /health/ready; API reference at /scalar when NODE_ENV=development)
  Workers health    http://localhost:8081/health/ready
  RabbitMQ UI       http://localhost:15672
  Mailpit           http://localhost:8025   (confirmation and reset emails)

The SuperAdmin password above is shown only on the first run. Sign in at http://localhost:3000/login
and set up two-factor authentication on the account page.
INFO
