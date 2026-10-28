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

Done: atomic Redis Lua pairing in separate queues per mode and pool (standard, low-trust, shadow); shared-interest preference with random fallback; language filter; blocks in both directions (subject and device); no immediate re-match; ended sessions kept for the 10-minute report window; presence sweeping. Pool chosen per search from bans and trust (Phase 5).

## Changelog

- 2026-10-25: Feature documented (Phase 1 scaffolding).
- 2026-10-25: Implemented in Phase 3.
- 2026-10-28: Matchmaking pools and report window (Phase 5).
