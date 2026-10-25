#!/usr/bin/env bash
# Creates backend/.env from .env.example with freshly generated secrets. Safe to re-run: never overwrites.
set -euo pipefail
cd "$(dirname "$0")/.."

if [[ -f .env ]]; then
  echo "backend/.env already exists; leaving it unchanged."
  exit 0
fi

random_secret() { head -c 32 /dev/urandom | base64 | tr -dc 'A-Za-z0-9' | head -c 32; }

while IFS= read -r line; do
  if [[ "$line" == *=change-me ]]; then
    echo "${line%change-me}$(random_secret)"
  else
    echo "$line"
  fi
done < .env.example > .env

echo "Created backend/.env with generated secrets."
