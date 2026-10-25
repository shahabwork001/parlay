# Feature: Rate limiting

Status: In progress
Last updated: 2026-10-25

## Purpose

Redis sliding-window limits per IP, device and account.

## User stories / use cases

- As an operator, abusive clients are throttled.

## API endpoints / hub methods / events involved

`rateLimit()` middleware; `RateLimiter` port; `RedisRateLimiter`

## Data model

Redis sorted sets `rl:{rule}:{hashed IP}` (sliding-window log, atomic Lua, Redis server time).

## Business rules

- Limits: matches/min, messages/sec, reports/hour; configurable at runtime.

## Current state (what works, what's missing, known issues)

Auth endpoints are limited per hashed IP (login 10/min, register 5/h, anonymous 30/h, forgot 5/h, reset 10/h, verify 20/h, 2FA confirm 10/5 min, refresh 60/min); 429 with Retry-After. Fails open if Redis is down. `RATE_LIMIT_MULTIPLIER` scales all limits (1 in production). Remaining in Phase 5: per-device and per-account limits, matchmaking/message/report limits, admin-editable limits.

## Changelog

- 2026-10-25: Feature documented (Phase 1 scaffolding).
- 2026-10-25: Implemented in Phase 2 (identity).
- 2026-10-25: Per-connection chat flood control (Phase 3).
