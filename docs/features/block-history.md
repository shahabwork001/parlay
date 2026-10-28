# Feature: Block and skip history

Status: Done
Last updated: 2026-10-25

## Purpose

Never re-match a user you blocked.

## User stories / use cases

- As a user, once I block someone I will never see them again.

## API endpoints / hub methods / events involved

`match:block`; event `chat.partner-blocked.v1` (API -> workers)

## Data model

Redis `mm:blocks:{subject}` (hot path); MongoDB `blocks` collection (durable, idempotent by blocker:blocked).

## Business rules

- Blocks are checked during pairing.
- Blocks are keyed by account or device hash.

## Current state (what works, what's missing, known issues)

Done: blocking ends the chat (the partner sees an ordinary 'left'), and the blocker never matches that account or device again, in either direction. Recent partners are also not re-matched for 60 s after Next.

## Changelog

- 2026-10-25: Feature documented (Phase 1 scaffolding).
- 2026-10-25: Implemented in Phase 3 (matchmaking and text chat).
- 2026-10-28: Reports block the partner too (Phase 5).
