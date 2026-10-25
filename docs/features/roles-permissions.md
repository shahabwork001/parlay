# Feature: Roles and permissions

Status: In progress
Last updated: 2026-10-25

## Purpose

SuperAdmin, Admin, Moderator and Support roles mapped to fine-grained permissions.

## User stories / use cases

- As a SuperAdmin, I can grant staff exactly the permissions their role needs.

## API endpoints / hub methods / events involved

GET /api/v1/me returns roles and permissions

## Data model

Session principal roles.

## Business rules

- Backend authorization is policy-based per permission.
- Frontend route guards mirror backend permissions but are never the only check.

## Current state (what works, what's missing, known issues)

Roles and permissions are available to the UI (account page shows roles). Admin route guards are built with the admin panel in Phase 6.

## Changelog

- 2026-10-25: Feature documented (Phase 1 scaffolding).
- 2026-10-25: Implemented in Phase 2 (identity).
