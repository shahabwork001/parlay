#!/bin/sh
set -eu
cd "$(dirname "$0")/.."
test "${BRANCH_NAME:-}" = main && test -z "${CHANGE_ID:-}" && test -z "${TAG_NAME:-}" || {
  echo 'Production deployment requires a non-PR main branch build.' >&2; exit 1;
}
sha=$(cat .release/commit)
test "$sha" = "${RELEASE_SHA:?}" || exit 1
case "$sha" in *[!0-9a-f]*|'') exit 1;; esac
test "${#sha}" -eq 40 || exit 1
case "${BUILD_NUMBER:?}" in *[!0-9]*|'') exit 1;; esac
: "${SSH_KNOWN_HOSTS:?}"
# Fixed deployment target; no user-supplied shell paths or arbitrary SSH options.
target=shahab@178.104.162.246
release="/home/shahab/apps/parley-preview/releases/$sha-$BUILD_NUMBER"
ssh -o BatchMode=yes -o StrictHostKeyChecking=yes -o "UserKnownHostsFile=$SSH_KNOWN_HOSTS" "$target" "mkdir -p '$release'"
scp -o BatchMode=yes -o StrictHostKeyChecking=yes -o "UserKnownHostsFile=$SSH_KNOWN_HOSTS" \
  .release/images.tar .release/images.tar.sha256 .release/commit .release/*.id \
  deploy/hetzner/deploy-release.sh "$target:$release/"
ssh -o BatchMode=yes -o StrictHostKeyChecking=yes -o "UserKnownHostsFile=$SSH_KNOWN_HOSTS" \
  "$target" "sh '$release/deploy-release.sh' '$release'"
: "${PARLEY_PUBLIC_API_URL:?}"
: "${PARLEY_PUBLIC_SITE_URL:?}"
case "$PARLEY_PUBLIC_API_URL,$PARLEY_PUBLIC_SITE_URL" in https://*,https://*) ;; *) exit 1;; esac
curl --fail --silent --show-error --retry 6 --retry-delay 5 --retry-all-errors "$PARLEY_PUBLIC_API_URL/health/ready" > /dev/null
curl --fail --silent --show-error --retry 6 --retry-delay 5 --retry-all-errors "$PARLEY_PUBLIC_SITE_URL/robots.txt" > /dev/null
echo "Production health verified for $sha"
