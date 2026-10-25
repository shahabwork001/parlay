# Feature: Interest and language matching

Status: Done
Last updated: 2026-10-25

## Purpose

Prefer partners with shared interests and language, falling back to random after a configurable timeout.

## User stories / use cases

- As a user, I am matched with someone who shares my interests when possible.

## API endpoints / hub methods / events involved

`queue:join` from the chat page with the saved preferences

## Data model

Preferences store (interests, language).

## Business rules

- Fallback timeout is configurable at runtime.
- Premium users can weight interests (see premium-features).

## Current state (what works, what's missing, known issues)

Done: interests and language from the landing page are sent on every search; the chat shows the shared interests when matched.

## Changelog

- 2026-10-25: Feature documented (Phase 1 scaffolding).
- 2026-10-25: Implemented in Phase 3 (matchmaking and text chat).
