#!/usr/bin/env bash
# Creates frontend/.env from .env.example. Safe to re-run: never overwrites.
set -euo pipefail
cd "$(dirname "$0")/.."

if [[ -f .env ]]; then
  echo "frontend/.env already exists; leaving it unchanged."
  exit 0
fi

cp .env.example .env
echo "Created frontend/.env."
