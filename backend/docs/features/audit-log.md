# Feature: Audit log

Status: Done
Last updated: 2026-10-25

## Purpose

Immutable record of every admin action (who, what, when, before/after).

## User stories / use cases

- As a SuperAdmin, I can see exactly who did what.

## API endpoints / hub methods / events involved

GET /api/v1/admin/audit (action, actorId, targetId, page) (`audit.view`); `AuditLog` port

## Data model

`audit_log`: actor {kind, subjectId, roles}, action, target {type, id}, metadata, at.

## Business rules

- Append-only; written asynchronously via RabbitMQ.
- Filterable and paginated.

## Current state (what works, what's missing, known issues)

Done: evidence.viewed, report.decided, report.escalated, ban.issued (automatic and moderator), ban.issued_manually, ban.lifted, appeal.accepted, appeal.rejected, rules.updated, staff.roles_changed. Insert-only; event-derived entries are idempotent.

## Changelog

- 2026-10-25: Feature documented (Phase 1 scaffolding).
- 2026-10-28: Implemented in Phase 6 (admin panel).
