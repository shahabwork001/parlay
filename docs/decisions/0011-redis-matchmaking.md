# 0011: Matchmaking in atomic Redis Lua scripts

Date: 2026-10-25. Status: Accepted.

## Context

Pairing must take under a second at p95, never match one person twice, and work across several API instances. MongoDB must stay off the hot path.

## Decision

- Queues, tickets, live sessions, blocks, recent partners and presence live in Redis.
- Pairing and session ending are Lua scripts (EVALSHA with an EVAL fallback), so each decision is atomic across instances without locks.
- A pairing attempt inspects at most 200 waiting tickets oldest-first and prefers the most shared interests. Random pairing needs both sides to accept it (no interests, or past the fallback wait).
- Waiting sockets retry every 2 s, which applies the interest fallback without a central scheduler.
- Presence is refreshed by the instance that owns the socket; a lease-guarded sweeper cleans up after crashed instances.

## Consequences

Each attempt costs O(scan limit) inside Redis, serialised per node, which handles thousands of waiting users per node. Keys are derived inside the scripts, so a Redis Cluster deployment must pin matchmaking keys to one slot (hash-tagged prefix) or shard queues by mode or region. Blocks are durable in MongoDB through an event, but the hot-path copy is the Redis set.
