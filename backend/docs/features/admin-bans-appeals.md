# Feature: Bans and appeals admin

Status: Done
Last updated: 2026-10-25

## Purpose

List, filter and lift bans; review appeals.

## User stories / use cases

- As a moderator, I can review appeals and lift bans.

## API endpoints / hub methods / events involved

GET /api/v1/admin/bans (filter active | appeals | all, target) (`users.view`); POST .../{id}/lift (`bans.manage`); POST .../{id}/appeal {accept} (`appeals.review`); `LiftBan`, `DecideAppeal`, `BanService.decideAppeal`

## Data model

`bans.appeal.status` pending | accepted | rejected, `decidedAt`; accepted appeals set `liftedAt`.

## Business rules

- Filters are URL-synced.

## Current state (what works, what's missing, known issues)

Done: accepting an appeal lifts the ban (cache cleared); rejecting closes it. Each action is audit-logged. The person sees the outcome on /banned.

## Changelog

- 2026-10-25: Feature documented (Phase 1 scaffolding).
- 2026-10-28: Implemented in Phase 6 (admin panel).
