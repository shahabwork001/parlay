# Feature: Ban and appeal experience

Status: Done
Last updated: 2026-10-25

## Purpose

Banned users see the reason and duration and can submit an appeal.

## User stories / use cases

- As a banned user, I understand why and can appeal.

## API endpoints / hub methods / events involved

GET /api/v1/me/ban -> {ban | null}; POST /api/v1/me/ban/appeal {message 20..2000} -> 201 {ban}; `GetMyBan`, `SubmitAppeal`

## Data model

`bans.appeal`: message, submittedAt, status (pending | accepted | rejected), decidedAt.

## Business rules

- One open appeal per ban.

## Current state (what works, what's missing, known issues)

Done: the most severe full ban for the account, device or network is shown (shadow bans never are). One appeal per ban. Reviewing appeals arrives in Phase 6.

## Changelog

- 2026-10-25: Feature documented (Phase 1 scaffolding).
- 2026-10-28: Implemented in Phase 5 (moderation and safety).
