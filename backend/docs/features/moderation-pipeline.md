# Feature: Server-side moderation pipeline

Status: Done
Last updated: 2026-10-25

## Purpose

Reports and flagged frames are scored by a pluggable IContentClassifier in a worker and routed to the human review queue with priority.

## User stories / use cases

- As a moderator, the most severe reports reach me first.

## API endpoints / hub methods / events involved

Consumers: moderation.scoring (`ScoreReport`), trust.sessions, trust.flags, audit.bans; `ContentClassifier` port with `HeuristicContentClassifier`

## Data model

Updates `reports.score`, `priority`, `tier`, `scoredAt`; `trust_scores`; `audit_log`.

## Business rules

- Runs in the workers process via RabbitMQ.
- Ships a free local classifier implementation.

## Current state (what works, what's missing, known issues)

Done: each report is classified (skin-tone ratio for the snapshot, text rules for the reported person's messages), prioritised (category base + classifier x 20 + low trust + recent reports, low-trust reporters weigh less; minor safety always 100) and scored once (idempotent). Reports from 3 different people within an hour suspend the person for 24 hours. The heuristic classifier only orders the queue; swap in a model behind the port (ADR 0012).

## Changelog

- 2026-10-25: Feature documented (Phase 1 scaffolding).
- 2026-10-28: Implemented in Phase 5 (moderation and safety).
