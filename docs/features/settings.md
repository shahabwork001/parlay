# Feature: User settings

Status: Done
Last updated: 2026-10-25

## Purpose

Theme, default devices and notification preferences.

## User stories / use cases

- As a user, I can choose light, dark or system theme.
- As a user, my default camera and microphone are remembered.

## API endpoints / hub methods / events involved

Route /settings

## Data model

localStorage `parley.settings` (cameraId, microphoneId, relayOnly, matchSound); theme via next-themes.

## Business rules

- Theme toggle already exists in the header (Phase 1).

## Current state (what works, what's missing, known issues)

Done: theme (system/light/dark), default camera and microphone, relay-only video (hides IP from partners) and a match chime. Linked from the footer and the account menu.

## Changelog

- 2026-10-25: Feature documented (Phase 1 scaffolding).
- 2026-10-25: Account settings page added (Phase 2).
- 2026-10-26: Implemented in Phase 4 (video chat).
