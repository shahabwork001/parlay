# Feature: Staff two-factor authentication

Status: Done
Last updated: 2026-10-25

## Purpose

Mandatory TOTP two-factor authentication for all staff accounts.

## User stories / use cases

- As a staff member, I must enrol TOTP before accessing the admin panel.

## API endpoints / hub methods / events involved

AccountRepository.startTwoFactorSetup / confirmTwoFactorSetup

## Data model

None persisted client-side.

## Business rules

- Staff tokens are only issued after a valid TOTP code.
- Recovery codes are hashed.

## Current state (what works, what's missing, known issues)

Done: setup with QR code and manual key, first-code confirmation, recovery codes shown once with copy; sign-in second step with authenticator or recovery code. Staff without 2FA see a notice on the account page.

## Changelog

- 2026-10-25: Feature documented (Phase 1 scaffolding).
- 2026-10-25: Implemented in Phase 2 (identity).
