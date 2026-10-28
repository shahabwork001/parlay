# Feature: In-chat reporting

Status: Done
Last updated: 2026-10-25

## Purpose

One-click report with reason categories, snapshot frame and recent messages; reporting disconnects and blocks the partner.

## User stories / use cases

- As a user, I can report someone in one click and never see them again.

## API endpoints / hub methods / events involved

- POST /api/v1/reports {sessionId, category, note?, snapshot? (JPEG data URL, max 96 000 chars)} -> 201 {id}; 30/h per IP plus 10/h per account and per device
- `SubmitReport` use case; `ChatSessionControl` port (implemented by the gateway)

## Data model

`reports`: sessionId, mode, category, note, reporter and reported (subject, device, kind, network and subnet hashes), evidenceId, status, priority, tier, score, escalation, timestamps. Unique on (sessionId, reporter). Evidence in `evidence` (see Evidence retention).

## Business rules

- Snapshot capture is disclosed in the Terms.
- Reports per hour are rate limited.
- Report creation publishes an event; persistence is asynchronous.

## Current state (what works, what's missing, known issues)

Done: the reporter must be a participant of a live chat or one that ended less than 10 minutes ago (`mm:ended:{id}` keeps the session for the report window). Submitting ends the chat (partner sees `left`, never `reported`), blocks the partner (Redis + PartnerBlocked event), copies the last 10 buffered messages and the snapshot into evidence, stores the report and publishes `moderation.report-submitted.v1`. Minor-safety categories also suspend the reported person immediately.

## Changelog

- 2026-10-25: Feature documented (Phase 1 scaffolding).
- 2026-10-28: Implemented in Phase 5 (moderation and safety).
