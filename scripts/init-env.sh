#!/usr/bin/env bash
# Creates backend/.env from .env.example with freshly generated secrets.
# Safe to re-run: existing values are never changed; keys missing from .env are appended.
set -euo pipefail
cd "$(dirname "$0")/.."

random_secret() { head -c 48 /dev/urandom | base64 | tr -dc 'A-Za-z0-9' | head -c 40; }
random_key() { head -c 32 /dev/urandom | base64 | tr -d '\n'; }

resolve() {
  local key="$1" value="$2"
  if [[ "$value" != "change-me" ]]; then
    echo "$value"
  elif [[ "$key" == *_KEY ]]; then
    random_key
  else
    random_secret
  fi
}

created=false
if [[ ! -f .env ]]; then
  : > .env
  created=true
fi

added=0
while IFS= read -r line || [[ -n "$line" ]]; do
  if [[ -z "$line" || "$line" == \#* ]]; then
    if $created; then echo "$line" >> .env; fi
    continue
  fi
  key="${line%%=*}"
  if ! grep -q "^${key}=" .env; then
    echo "${key}=$(resolve "$key" "${line#*=}")" >> .env
    added=$((added + 1))
  fi
done < .env.example

if $created; then
  echo "Created backend/.env with generated secrets."
elif (( added > 0 )); then
  echo "Added ${added} missing setting(s) to backend/.env."
else
  echo "backend/.env is up to date."
fi
