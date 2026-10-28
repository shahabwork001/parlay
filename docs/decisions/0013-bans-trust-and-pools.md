# 0013: Bans in MongoDB with a Redis write-through cache; trust and shadow bans as matchmaking pools

Status: Accepted (2026-10-28)

## Context

Bans must be checked on every socket connect and every search, cover accounts, devices, IP addresses and subnets, and support temporary, permanent and shadow bans. Low-trust and shadow-banned people must be matched only with each other. IP addresses must not be stored raw.

## Decision

- **Source of truth**: a `bans` collection. Each ban lists its targets; a `targetKeys` multikey index (`kind:value`) answers "is any of these banned?" in one query.
- **Hot path**: a Redis sorted set per target, `ban:{kind}:{value}`, with members `{banId}|{mode}` scored by expiry (`+inf` when permanent). Written through on issue and lift, rebuilt from MongoDB on API start. Expired members are ignored by score and trimmed on write.
- **Network targets** are keyed HMAC hashes of the IP address and of its /24 (IPv4) or /64 (IPv6) subnet, computed with the same `HASH_SECRET` as device hashes. Moderators can therefore ban a network seen in a report without anyone storing or seeing the address.
- **Enforcement**: every socket joins `subject:`, `device:`, `net:` and `subnet:` rooms. A full ban emits `moderation:banned` to those rooms and disconnects them through `@socket.io/redis-emitter`, which works from the API and from the workers. Reconnection is refused at the handshake.
- **Automatic bans** cover only the account and device, never shared networks, so one person on a campus network cannot get everyone banned.
- **Pools**: the matchmaker keys queues by mode and pool (`standard`, `low-trust`, `shadow`); the Lua pairing script never looks outside its pool. The gateway picks the pool on every search from the ban cache (shadow) and the trust score (below 25 is low trust). Both participants are always in the same pool, so the pool also sets the stricter screening threshold for the session.
- **Trust** lives in `trust_scores` (one document per `user:` or `device:` key, clamped 0..100 inside the update) with a 5-minute Redis cache. The lower of a person's account and device scores applies.

## Consequences

- A ban takes effect within one Redis round trip everywhere; a Redis flush only needs an API restart (or the next warm-up) to recover.
- Shadow bans are invisible to the person (no notice, no appeal) and to their partners, who are themselves shadow-banned.
- Trust adjustments are at-least-once and may occasionally apply twice on redelivery; the magnitudes (+1, -3, -5) make that harmless. Moderator decisions (Phase 6) use larger, explicit adjustments.
