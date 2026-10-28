# Feature: Minor safety escalation

Status: Done
Last updated: 2026-10-25

## Purpose

Reports of apparent minors or child sexual content get top priority, instant suspension, evidence preservation and an escalation step (e.g. NCMEC CyberTipline).

## User stories / use cases

- As a moderator, I have a clear workflow to escalate child-safety reports to the relevant authority.

## API endpoints / hub methods / events involved

`ReportDialog`

## Data model

None.

## Business rules

- Instant suspension pending review.
- Evidence is preserved beyond normal retention.
- Every access is audited.

## Current state (what works, what's missing, known issues)

Done: both categories in the report dialog, with an explanation that the person is suspended during review.

## Changelog

- 2026-10-25: Feature documented (Phase 1 scaffolding).
- 2026-10-28: Implemented in Phase 5 (moderation and safety).
