# Feature: In-chat reporting

Status: Done
Last updated: 2026-10-25

## Purpose

One-click report with reason categories, snapshot frame and recent messages; reporting disconnects and blocks the partner.

## User stories / use cases

- As a user, I can report someone in one click and never see them again.

## API endpoints / hub methods / events involved

`ReportDialog`; `ModerationRepository.submitReport`; `captureStreamFrame`

## Data model

None stored. The snapshot is taken when Report is pressed (320 px JPEG).

## Business rules

- Snapshot capture is disclosed in the Terms.
- Reports per hour are rate limited.
- Report creation publishes an event; persistence is asynchronous.

## Current state (what works, what's missing, known issues)

Done: Report in the text and video toolbars while chatting and after a chat ends. Dialog with 11 categories, optional note, disclosure of what is sent (still image for video, last messages), minor-safety explanation, required-category validation, pending and error states. On success the chat shows a confirmation and Report disappears.

## Changelog

- 2026-10-25: Feature documented (Phase 1 scaffolding).
- 2026-10-28: Implemented in Phase 5 (moderation and safety).
