# Feature: Audit log

Status: Not started
Last updated: 2026-10-25

## Purpose

Immutable record of every admin action (who, what, when, before/after).

## User stories / use cases

- As a SuperAdmin, I can see exactly who did what.

## API endpoints / hub methods / events involved

To be defined when implementation starts (planned for Phase 6).

## Data model

To be defined when implementation starts (planned for Phase 6).

## Business rules

- Append-only; written asynchronously via RabbitMQ.
- Filterable and paginated.

## Current state (what works, what's missing, known issues)

Not started. Planned for Phase 6.

## Changelog

- 2026-10-25: Feature documented (Phase 1 scaffolding).
