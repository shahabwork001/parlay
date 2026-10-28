# Feature: Moderation queue

Status: Done
Last updated: 2026-10-25

## Purpose

Prioritised reports with evidence, trust scores and history; dismiss, warn, temp ban, perma ban, shadow-ban and escalate with keyboard shortcuts.

## User stories / use cases

- As a moderator, I can review reports quickly from the keyboard.

## API endpoints / hub methods / events involved

Route /admin/reports; `ReportQueue`, `ReportReview`, `BanDialog`; shortcuts J/K/D/W/B

## Data model

TanStack Query `admin/reports/...` (polled 15 s), `admin/report/{id}`, `admin/evidence/{id}`.

## Business rules

- Every action is audited.

## Current state (what works, what's missing, known issues)

Done: two-pane review (list and detail; stacked on phones), note preview in the list, evidence loaded only on request (audit-logged) with the snapshot blurred until revealed, the last messages, escalation form for minor-safety reports, keyboard shortcuts that ignore typing and open dialogs, auto-advance to the next report.

## Changelog

- 2026-10-25: Feature documented (Phase 1 scaffolding).
- 2026-10-28: Implemented in Phase 6 (admin panel).
