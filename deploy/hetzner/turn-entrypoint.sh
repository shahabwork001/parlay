#!/bin/sh
set -eu
# Docker bridge IPs may change when the container is recreated.
relay_ip=$(hostname -i | awk '{print $1}')
test -n "$relay_ip"
# Coturn maps same-server relay peers back to its bridge IP. Permit only
# this container for hairpin calls; all other private ranges stay denied.
exec turnserver "$@" \
  "--relay-ip=$relay_ip" \
  "--external-ip=${TURN_PUBLIC_IP:?}/$relay_ip" \
  "--allowed-peer-ip=$relay_ip"
