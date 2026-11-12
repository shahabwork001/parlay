# Feature: No chat recording

Status: Done
Last updated: 2026-10-25

## Purpose

The platform never stores video or full chat logs; only report snapshots and the last N messages attached to a report.

## User stories / use cases

- As a user, I can trust that my conversations are not recorded.

## API endpoints / hub methods / events involved

Privacy page

## Data model

None.

## Business rules

- Stated on the Privacy page.
- Enforced by design: hub messages are relayed, never persisted.

## Current state (what works, what's missing, known issues)

Done: the Privacy page states what is never stored, the 15-minute buffer, on-device screening, retention periods and audit logging.

## Changelog

- 2026-10-25: Feature documented (Phase 1 scaffolding).
- 2026-10-28: Implemented in Phase 5 (moderation and safety).
