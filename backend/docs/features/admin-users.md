# Feature: Users and devices

Status: Done
Last updated: 2026-10-25

## Purpose

Search users and devices, view details, session metadata, bans, reports and subscription; manual actions.

## User stories / use cases

- As support staff, I can look up a user and act on their account.

## API endpoints / hub methods / events involved

GET /api/v1/admin/users?q (`users.view`), GET /api/v1/admin/users/{id}; POST /api/v1/admin/bans (`bans.manage`); `GetUserDetail`, `IssueManualBan`

## Data model

Read side over `users`, `refresh_tokens` (sign-in families: device, first and last activity, 2FA, active), `reports`, `bans`, `trust_scores`.

## Business rules

- Session history is metadata only.

## Current state (what works, what's missing, known issues)

Done: search by email substring (regex-escaped) or exact id; detail with trust, sign-ins (metadata only, last 30 days), reports against and filed, bans; manual bans of the account and its devices (or a typed IP address, stored hashed).

## Changelog

- 2026-10-25: Feature documented (Phase 1 scaffolding).
- 2026-10-28: Implemented in Phase 6 (admin panel).
