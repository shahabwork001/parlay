# Feature: Landing page

Status: In progress
Last updated: 2026-10-25

## Purpose

Explain the product in one screen and let people start a video or text chat with optional interests and language.

## User stories / use cases

- As a visitor, I understand what Parley is and its rules before starting.
- As a visitor, I can add interest tags and pick a language.
- As a visitor, I can start a video or text chat.

## API endpoints / hub methods / events involved

To be defined when implementation starts (planned for Phase 1).

## Data model

To be defined when implementation starts (planned for Phase 1).

## Business rules

- Interests: 2-24 chars, letters/numbers/spaces/hyphens, max 10, normalised to lower case.
- Preferences persist in localStorage (parley.preferences).
- Landing page is statically prerendered (Lighthouse >= 90).

## Current state (what works, what's missing, known issues)

Works: hero, ground rules, principles, start panel with interest tags and language selector (persisted). Start buttons link to /chat/video and /chat/text, which are implemented in Phase 3/4. Footer links to static pages that arrive in Phase 2.

## Changelog

- 2026-10-25: Feature documented (Phase 1 scaffolding).
