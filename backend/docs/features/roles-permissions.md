# Feature: Roles and permissions

Status: Done
Last updated: 2026-10-25

## Purpose

SuperAdmin, Admin, Moderator and Support roles mapped to fine-grained permissions.

## User stories / use cases

- As a SuperAdmin, I can grant staff exactly the permissions their role needs.

## API endpoints / hub methods / events involved

`requirePermission(permission)` middleware; roles in the access token (`rol` claim, validated on every request)

## Data model

`src/domain/identity/roles.ts`: ROLES, PERMISSIONS and ROLE_PERMISSIONS (single source of truth).

## Business rules

- Backend authorization is policy-based per permission.
- Frontend route guards mirror backend permissions but are never the only check.

## Current state (what works, what's missing, known issues)

Done: SuperAdmin (all), Admin (all but staff management), Moderator (review, act, escalate, bans, appeals, users view), Support (dashboard, users view, appeals). Permissions are checked per route and require a multi-factor session. Admin routes that use them arrive in Phase 6.

## Changelog

- 2026-10-25: Feature documented (Phase 1 scaffolding).
- 2026-10-25: Implemented in Phase 2 (identity).
