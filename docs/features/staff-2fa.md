# Feature: Staff two-factor authentication

Status: Done
Last updated: 2026-10-25

## Purpose

Mandatory TOTP two-factor authentication for all staff accounts.

## User stories / use cases

- As a staff member, I must enrol TOTP before accessing the admin panel.

## API endpoints / hub methods / events involved

- POST /api/v1/me/two-factor/setup
- POST /api/v1/me/two-factor/confirm
- POST /api/v1/auth/login with totpCode or recoveryCode

## Data model

users.twoFactor: TOTP secret encrypted with AES-256-GCM, 10 single-use recovery codes stored as HMACs.

## Business rules

- Staff tokens are only issued after a valid TOTP code.
- Recovery codes are hashed.

## Current state (what works, what's missing, known issues)

Done: RFC 6238 TOTP (30 s, +/-1 step). Confirming 2FA revokes all other sessions and issues a multi-factor session. Staff permissions are denied (`auth.mfa_required`) on sessions without a second factor. The seed creates the first SuperAdmin, who must enrol 2FA.

## Changelog

- 2026-10-25: Feature documented (Phase 1 scaffolding).
- 2026-10-25: Implemented in Phase 2 (identity).
