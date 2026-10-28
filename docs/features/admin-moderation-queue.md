# Feature: Moderation queue

Status: Done
Last updated: 2026-10-25

## Purpose

Prioritised reports with evidence, trust scores and history; dismiss, warn, temp ban, perma ban, shadow-ban and escalate with keyboard shortcuts.

## User stories / use cases

- As a moderator, I can review reports quickly from the keyboard.

## API endpoints / hub methods / events involved

GET /api/v1/admin/reports (status, tier, page), GET /api/v1/admin/reports/{id} (`reports.review`); POST .../decision (`moderation.act`); POST .../escalation (`moderation.escalate`); `DecideReport`, `RecordEscalation`, `GetReportDetail`

## Data model

`reports.resolution` {outcome dismissed | warned | banned, by, at, note}; `escalation`, `escalationReference`.

## Business rules

- Every action is audited.

## Current state (what works, what's missing, known issues)

Done: open queue by priority then age; detail with trust scores, history and active bans. Dismiss (reporter trust -5), warn (reported trust -15, `moderation:warning` to the person), ban (full or shadow, duration, optional network, reported trust -15). Lifts the automatic pending-review suspension the report caused. Minor-safety reports need `moderation.escalate`; dismissing one marks escalation not required. Every decision is audit-logged.

## Changelog

- 2026-10-25: Feature documented (Phase 1 scaffolding).
- 2026-10-28: Implemented in Phase 6 (admin panel).
