# Feature: Rate limiting

Status: Done
Last updated: 2026-10-25

## Purpose

Redis sliding-window limits per IP, device and account.

## User stories / use cases

- As an operator, abusive clients are throttled.

## API endpoints / hub methods / events involved

`rateLimit()` middleware; `RateLimiter` port; `RedisRateLimiter`; `ChatGateway.withinLimits`

## Data model

Redis sorted sets `rl:{rule}:{key}` (sliding-window log, atomic Lua).

## Business rules

- Limits: matches/min, messages/sec, reports/hour; configurable at runtime.

## Current state (what works, what's missing, known issues)

Done: HTTP limits per hashed IP (auth endpoints, reports 30/h, appeals 5/h). Chat limits per account, device and network: 30 searches per minute and 5 messages per second (network limits 4x for shared connections). Reports 10/h per account and per device. Per-connection buckets for typing, signaling and flags. All scale with `RATE_LIMIT_MULTIPLIER`; chat limits fail open if Redis is down. Admin-editable limits arrive with site configuration (Phase 7).

## Changelog

- 2026-10-25: Feature documented (Phase 1 scaffolding).
- 2026-10-25: Implemented in Phase 2 (identity).
- 2026-10-25: Per-connection chat flood control (Phase 3).
- 2026-10-28: Implemented in Phase 5 (moderation and safety).
