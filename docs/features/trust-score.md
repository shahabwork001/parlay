# Feature: Trust score

Status: Done
Last updated: 2026-10-25

## Purpose

Per-user/device score lowered by valid reports and flags, raised by clean sessions.

## User stories / use cases

- As an operator, low-trust users are isolated from everyone else.

## API endpoints / hub methods / events involved

`TrustStore` (`CachedTrustStore`); `RewardCleanSession`, `PenaliseFlaggedContent`; trust constants in the domain

## Data model

`trust_scores`: _id `user:{id}` or `device:{id}`, score 0..100 (default 50), updatedAt. Redis cache `trust:{key}` for 5 minutes.

## Business rules

- Low-trust users get stricter thresholds and are matched with each other.

## Current state (what works, what's missing, known issues)

Done: +1 per session of a minute or more, -3 per report received, -5 per content flag, -2 per blocked message (upheld reports -15 from Phase 6). The lower of account and device applies. Below 25: low-trust pool (matched only with each other) and stricter screening and text rules.

## Changelog

- 2026-10-25: Feature documented (Phase 1 scaffolding).
- 2026-10-28: Implemented in Phase 5 (moderation and safety).
