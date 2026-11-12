# Feature: Minor safety escalation

Status: Done
Last updated: 2026-10-25

## Purpose

Reports of apparent minors or child sexual content get top priority, instant suspension, evidence preservation and an escalation step (e.g. NCMEC CyberTipline).

## User stories / use cases

- As a moderator, I have a clear workflow to escalate child-safety reports to the relevant authority.

## API endpoints / hub methods / events involved

Categories `appears-minor`, `child-sexual-content`; `docs/minor-safety-workflow.md`

## Data model

`reports.escalation` (required | reported | not-required); suspension ban with reason pending-review; evidence retention 365 days.

## Business rules

- Instant suspension pending review.
- Evidence is preserved beyond normal retention.
- Every access is audited.

## Current state (what works, what's missing, known issues)

Done: priority 100 (critical), instant suspension of account and device pending review, evidence preserved for a year, evidence restricted to `moderation.escalate` and audit-logged. The escalation step (recording an NCMEC CyberTipline or hotline report) is documented in docs/minor-safety-workflow.md; its admin screen arrives in Phase 6.

## Changelog

- 2026-10-25: Feature documented (Phase 1 scaffolding).
- 2026-10-28: Implemented in Phase 5 (moderation and safety).
