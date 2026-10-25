# Feature: Interest and language matching

Status: Done
Last updated: 2026-10-25

## Purpose

Prefer partners with shared interests and language, falling back to random after a configurable timeout.

## User stories / use cases

- As a user, I am matched with someone who shares my interests when possible.

## API endpoints / hub methods / events involved

`queue:join` {interests (max 10, normalised), language (ISO 639-1 or any)}

## Data model

Redis (prefix `mm`): `queue:{mode}` (ZSET by enqueue time), `ticket:{subject}` (HASH: device, language, interests, enqueuedAt), `active:{subject}` -> session id, `session:{id}` (HASH: caller, callee, devices, mode, startedAt, shared), `sessions` (SET), `blocks:{subject}` (SET of subject and device ids), `recent:{subject}` (ZSET, 1 h), `presence:{subject}` (30 s TTL).

## Business rules

- Fallback timeout is configurable at runtime.
- Premium users can weight interests (see premium-features).

## Current state (what works, what's missing, known issues)

Done: most shared interests wins, then longest waiting. Without a shared interest, both sides must accept random partners: no interests, or waited at least `MATCH_INTEREST_FALLBACK_MS` (default 5 s). Languages must be equal unless either side chose any. Interest weighting for premium arrives in Phase 7.

## Changelog

- 2026-10-25: Feature documented (Phase 1 scaffolding).
- 2026-10-25: Implemented in Phase 3 (matchmaking and text chat).
