# Feature: Audit log

Status: Done
Last updated: 2026-10-25

## Purpose

Immutable record of every admin action (who, what, when, before/after).

## User stories / use cases

- As a SuperAdmin, I can see exactly who did what.

## API endpoints / hub methods / events involved

Route /admin/audit; `AuditLog`

## Data model

TanStack Query `admin/audit/...`.

## Business rules

- Append-only; written asynchronously via RabbitMQ.
- Filterable and paginated.

## Current state (what works, what's missing, known issues)

Done: filterable table, newest first, system actions labelled.

## Changelog

- 2026-10-25: Feature documented (Phase 1 scaffolding).
- 2026-10-28: Implemented in Phase 6 (admin panel).
