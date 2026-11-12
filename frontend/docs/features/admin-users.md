# Feature: Users and devices

Status: Done
Last updated: 2026-10-25

## Purpose

Search users and devices, view details, session metadata, bans, reports and subscription; manual actions.

## User stories / use cases

- As support staff, I can look up a user and act on their account.

## API endpoints / hub methods / events involved

Routes /admin/users, /admin/users/[id]; `UsersAdmin`, `UserDetailView`

## Data model

TanStack Query `admin/users/...`, `admin/user/{id}`.

## Business rules

- Session history is metadata only.

## Current state (what works, what's missing, known issues)

Done: search table, detail page with stats, sign-ins table, ban history and a manual ban form.

## Changelog

- 2026-10-25: Feature documented (Phase 1 scaffolding).
- 2026-10-28: Implemented in Phase 6 (admin panel).
