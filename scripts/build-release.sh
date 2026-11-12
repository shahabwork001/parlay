#!/bin/sh
set -eu
cd "$(dirname "$0")/.."
test "${BRANCH_NAME:-}" = main && test -z "${CHANGE_ID:-}" && test -z "${TAG_NAME:-}" || {
  echo 'Production images require a non-PR main branch build.' >&2; exit 1;
}
sha=$(git rev-parse HEAD)
test "$sha" = "${RELEASE_SHA:?}" || exit 1
case "$sha" in *[!0-9a-f]*|'') exit 1;; esac
test "${#sha}" -eq 40 || exit 1
: "${PARLEY_PUBLIC_API_URL:?Set the production HTTPS API origin in Jenkins}"
case "$PARLEY_PUBLIC_API_URL" in https://*) ;; *) echo 'HTTPS API origin required' >&2; exit 1;; esac
mkdir -p .release
for service in api workers; do
  docker build --target "$service" --label "org.opencontainers.image.revision=$sha" \
    --label org.opencontainers.image.source=https://github.com/shahabwork001/parlay \
    -t "parley-$service:$sha" backend
done
docker build --build-arg "NEXT_PUBLIC_API_BASE_URL=$PARLEY_PUBLIC_API_URL" \
  --label "org.opencontainers.image.revision=$sha" \
  --label org.opencontainers.image.source=https://github.com/shahabwork001/parlay \
  -t "parley-frontend:$sha" frontend
printf '%s\n' "$sha" > .release/commit
for service in api workers frontend; do
  docker image inspect --format '{{.Id}}' "parley-$service:$sha" > ".release/$service.id"
done
docker save -o .release/images.tar "parley-api:$sha" "parley-workers:$sha" "parley-frontend:$sha"
(cd .release && sha256sum images.tar > images.tar.sha256)
