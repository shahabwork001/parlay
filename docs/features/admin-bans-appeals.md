# Feature: Bans and appeals admin

Status: Done
Last updated: 2026-10-25

## Purpose

List, filter and lift bans; review appeals.

## User stories / use cases

- As a moderator, I can review appeals and lift bans.

## API endpoints / hub methods / events involved

Route /admin/bans; `BansAdmin`, `BanList`

## Data model

TanStack Query `admin/bans/...`.

## Business rules

- Filters are URL-synced.

## Current state (what works, what's missing, known issues)

Done: pending appeals first, active and all bans; lift, accept and reject with per-role visibility.

## Changelog

- 2026-10-25: Feature documented (Phase 1 scaffolding).
- 2026-10-28: Implemented in Phase 6 (admin panel).
