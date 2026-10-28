# Feature: Client-side NSFW screening

Status: Done
Last updated: 2026-10-25

## Purpose

NSFWJS in a Web Worker screens the user's own stream; flagged streams are blurred to the partner and reported.

## User stories / use cases

- As a user, I am protected from unexpected explicit content.

## API endpoints / hub methods / events involved

Socket.IO `moderation:flag` {source: nsfw-screening, score} -> ack {outcome: recorded | banned}; `match:found.safety.nsfwThreshold`; `RecordContentFlag`

## Data model

Redis sliding window `counter:moderation.flags:{deviceId}` (10 minutes). Event `moderation.content-flagged.v1`.

## Business rules

- Model is lazy-loaded.
- Repeated flags lead to an automatic temporary ban.

## Current state (what works, what's missing, known issues)

Done: 3 flags within 10 minutes ban the account and device for 24 hours automatically (reason repeated-flags). Each flag lowers trust by 5. Thresholds: 0.75 in the standard pool, 0.55 in low-trust and shadow pools.

## Changelog

- 2026-10-25: Feature documented (Phase 1 scaffolding).
- 2026-10-28: Implemented in Phase 5 (moderation and safety).
