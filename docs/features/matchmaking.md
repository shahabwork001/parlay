# Feature: Matchmaking

Status: Done
Last updated: 2026-10-25

## Purpose

Pair waiting users in under one second (p95) using atomic Redis operations.

## User stories / use cases

- As a user, I am matched with someone quickly.
- As an operator, a user is never matched with two people at once.

## API endpoints / hub methods / events involved

Socket.IO (same origin as the API, token in the handshake `auth.token`):

- client -> server: `queue:join` {mode, language, interests}, `match:next`, `queue:leave`, `match:block`, `chat:message` {text}, `chat:typing` {typing}; every call acknowledges `{ok, data | error}`
- server -> client: `match:found` {sessionId, mode, role, sharedInterests}, `match:ended` {sessionId, reason: skipped | left | disconnected}, `chat:message` {id, text, sentAt}, `chat:typing` {typing}
- connect errors: `auth.required`, `terms.outdated`

## Data model

Redis (prefix `mm`): `queue:{mode}` (ZSET by enqueue time), `ticket:{subject}` (HASH: device, language, interests, enqueuedAt), `active:{subject}` -> session id, `session:{id}` (HASH: caller, callee, devices, mode, startedAt, shared), `sessions` (SET), `blocks:{subject}` (SET of subject and device ids), `recent:{subject}` (ZSET, 1 h), `presence:{subject}` (30 s TTL).

## Business rules

- Queues live in Redis; pairing uses a Lua script for atomicity.
- No MongoDB access on the hot path.
- Blocked pairs, shadow-banned and low-trust users are segregated.

## Current state (what works, what's missing, known issues)

Done: pairing is one atomic Lua script (no double matches; verified with 200 concurrent joins). Waiting participants retry every 2 s so the interest fallback applies; the longer-waiting participant becomes the caller. Separate text and video queues. A participant is in at most one session. Shadow-ban and low-trust pools arrive in Phase 5. Scale note: each attempt scans up to 200 waiting tickets.

## Changelog

- 2026-10-25: Feature documented (Phase 1 scaffolding).
- 2026-10-25: Implemented in Phase 3 (matchmaking and text chat).
