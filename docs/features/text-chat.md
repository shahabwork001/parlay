# Feature: Text chat

Status: Done
Last updated: 2026-10-25

## Purpose

Real-time text chat over Socket.IO with typing indicator and delivery state.

## User stories / use cases

- As a user, I can exchange messages and see when my partner is typing.

## API endpoints / hub methods / events involved

Socket.IO (same origin as the API, token in the handshake `auth.token`):

- client -> server: `queue:join` {mode, language, interests}, `match:next`, `queue:leave`, `match:block`, `chat:message` {text}, `chat:typing` {typing}; every call acknowledges `{ok, data | error}`
- server -> client: `match:found` {sessionId, mode, role, sharedInterests}, `match:ended` {sessionId, reason: skipped | left | disconnected}, `chat:message` {id, text, sentAt}, `chat:typing` {typing}
- connect errors: `auth.required`, `terms.outdated`

## Data model

Messages are relayed, never stored.

## Business rules

- Messages are relayed, not stored (except the last N attached to a report).
- Profanity masking and link blocking by default (see text-moderation).

## Current state (what works, what's missing, known issues)

Done: messages are validated, capped at 1000 characters, cleaned (links replaced with [link removed], default profanity list masked with bullets, case and leetspeak tolerant) and relayed to the partner with a delivery ack carrying the cleaned text. Per-connection flood control: 10-message burst, 3/s sustained; typing 5 burst, 2/s. Admin-editable word lists and phone/handle rules arrive in Phase 5.

## Changelog

- 2026-10-25: Feature documented (Phase 1 scaffolding).
- 2026-10-25: Implemented in Phase 3 (matchmaking and text chat).
