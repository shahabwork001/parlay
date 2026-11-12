# Feature: Staff management

Status: Done
Last updated: 2026-10-25

## Purpose

Invite staff, assign roles, enforce 2FA.

## User stories / use cases

- As a SuperAdmin, I can onboard and offboard staff.

## API endpoints / hub methods / events involved

Route /admin/staff; `StaffAdmin`

## Data model

TanStack Query `admin/staff`.

## Business rules

- 2FA mandatory for staff.

## Current state (what works, what's missing, known issues)

Done: add staff by email with role checkboxes, edit or remove roles, 2FA status per member.

## Changelog

- 2026-10-25: Feature documented (Phase 1 scaffolding).
- 2026-10-28: Implemented in Phase 6 (admin panel).
