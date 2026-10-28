# Feature: Ban and appeal experience

Status: Done
Last updated: 2026-10-25

## Purpose

Banned users see the reason and duration and can submit an appeal.

## User stories / use cases

- As a banned user, I understand why and can appeal.

## API endpoints / hub methods / events involved

Route /banned; `BanNotice`

## Data model

TanStack Query `moderation/my-ban`.

## Business rules

- One open appeal per ban.

## Current state (what works, what's missing, known issues)

Done: reason, start date and duration (until a date, permanent, or until review), appeal form with validation and pending state, appeal status after submitting; loading, error/retry and not-banned states.

## Changelog

- 2026-10-25: Feature documented (Phase 1 scaffolding).
- 2026-10-28: Implemented in Phase 5 (moderation and safety).
