# Feature: No chat recording

Status: Done
Last updated: 2026-10-25

## Purpose

The platform never stores video or full chat logs; only report snapshots and the last N messages attached to a report.

## User stories / use cases

- As a user, I can trust that my conversations are not recorded.

## API endpoints / hub methods / events involved

`RecentMessages` (`RedisRecentMessages`)

## Data model

Redis list `chat:recent:{sessionId}`: last 20 filtered messages, expires 15 minutes after the last message. Never written to durable storage unless reported (10 messages copied into evidence).

## Business rules

- Stated on the Privacy page.
- Enforced by design: hub messages are relayed, never persisted.

## Current state (what works, what's missing, known issues)

Done: video and audio never touch the servers; text is relayed and only buffered briefly for reports.

## Changelog

- 2026-10-25: Feature documented (Phase 1 scaffolding).
- 2026-10-28: Implemented in Phase 5 (moderation and safety).
