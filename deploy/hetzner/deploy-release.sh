#!/bin/sh
set -eu
base=/home/shahab/apps/parley-preview
release=${1:?Release directory required}
case "$release" in "$base"/releases/*) ;; *) echo 'Invalid release path' >&2; exit 1;; esac
test "$(dirname "$release")" = "$base/releases" || exit 1
test ! -L "$release" || exit 1
cd "$release"
sha=$(cat commit)
case "$sha" in *[!0-9a-f]*|'') exit 1;; esac
test "${#sha}" -eq 40 || exit 1
# Serialize across all Jenkins runs and manual use of this deployment helper.
exec 9>"$base/.deployment.lock"
flock -w 900 9
sha256sum -c images.tar.sha256
docker load -i images.tar
printf 'services:\n' > images.override.yml
for service in api workers frontend; do
  expected=$(cat "$service.id")
  actual=$(docker image inspect --format '{{.Id}}' "parley-$service:$sha")
  test "$expected" = "$actual" || { echo "Image mismatch: $service" >&2; exit 1; }
  revision=$(docker image inspect --format '{{index .Config.Labels "org.opencontainers.image.revision"}}' "parley-$service:$sha")
  test "$revision" = "$sha" || exit 1
  # Pin local immutable image IDs; tags cannot drift between validation and up.
  printf '  %s:\n    image: %s\n' "$service" "$actual" >> images.override.yml
done
cd "$base"
compose() { sh deploy/hetzner/compose.sh -f "$release/images.override.yml" "$@"; }
compose config --quiet
# Preserve prior exact image IDs for operator-controlled rollback. No volumes removed.
printf 'services:\n' > "$release/rollback.override.yml"
for service in api workers frontend; do
  container=$(compose ps -q "$service")
  test -n "$container" || { echo "Existing $service missing; provision the host first" >&2; exit 1; }
  previous=$(docker inspect --format '{{.Image}}' "$container")
  printf '  %s:\n    image: %s\n' "$service" "$previous" >> "$release/rollback.override.yml"
done
# Existing Mongo/Redis/RabbitMQ/TURN/proxy and persistent volumes are retained.
compose up -d --no-build --pull never --no-deps --wait --wait-timeout 180 api workers frontend
for service in api workers frontend; do
  container=$(compose ps -q "$service")
  test "$(docker inspect --format '{{.Image}}' "$container")" = "$(cat "$release/$service.id")" || exit 1
done
compose exec -T api wget -qO- http://127.0.0.1:8080/health/ready > /dev/null
compose exec -T workers wget -qO- http://127.0.0.1:8081/health/ready > /dev/null
printf '%s\n' "$sha" > "$base/last-application-release"
echo "Exact images started: $sha; external HTTPS checks follow in Jenkins."
