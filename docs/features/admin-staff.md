# Feature: Staff management

Status: Done
Last updated: 2026-10-25

## Purpose

Invite staff, assign roles, enforce 2FA.

## User stories / use cases

- As a SuperAdmin, I can onboard and offboard staff.

## API endpoints / hub methods / events involved

GET /api/v1/admin/staff, PUT /api/v1/admin/staff/roles {email | userId, roles} (`staff.manage`); `SetStaffRoles`; tool `npm run staff:create`

## Data model

`users.roles`.

## Business rules

- 2FA mandatory for staff.

## Current state (what works, what's missing, known issues)

Done: grant, change or remove roles by email or id. Requires a confirmed email, protects the last SuperAdmin, forbids changing your own roles, and signs the person out everywhere so the next session carries the new roles (and needs 2FA). `create-staff` creates a staff account with 2FA enabled from the server shell.

## Changelog

- 2026-10-25: Feature documented (Phase 1 scaffolding).
- 2026-10-28: Implemented in Phase 6 (admin panel).
