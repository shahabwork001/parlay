# Feature: Evidence retention

Status: Done
Last updated: 2026-10-25

## Purpose

Report evidence stored with TTL per retention policy; every access logged.

## User stories / use cases

- As an operator, evidence is kept only as long as policy allows.

## API endpoints / hub methods / events involved

`EvidenceStore` (`MongoEvidenceStore`); `GetReportEvidence`; GET /api/v1/moderation/reports/{id}/evidence (`reports.review`, 2FA)

## Data model

`evidence`: reportId, snapshot (JPEG binary), messages [{from, text, sentAt}], createdAt, expiresAt with a TTL index (expireAfterSeconds 0). `audit_log` entry `evidence.viewed` per access.

## Business rules

- TTL indexes enforce retention.
- Minor-safety evidence is exempt from automatic expiry until resolved.

## Current state (what works, what's missing, known issues)

Done: 30 days (`EVIDENCE_RETENTION_DAYS`), 365 days for minor safety (`MINOR_SAFETY_RETENTION_DAYS`, minimum 365). Expired evidence is hidden immediately and deleted by MongoDB's TTL monitor. Every staff view is audit-logged before the evidence is returned.

## Changelog

- 2026-10-25: Feature documented (Phase 1 scaffolding).
- 2026-10-28: Implemented in Phase 5 (moderation and safety).
