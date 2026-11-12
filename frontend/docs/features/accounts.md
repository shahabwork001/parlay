# Feature: Accounts and authentication

Status: Done
Last updated: 2026-10-25

## Purpose

Optional email/password accounts with verification, JWT access tokens and rotating refresh tokens.

## User stories / use cases

- As a user, I can register, verify my email, sign in and reset my password.
- As a user, my session survives page reloads securely.

## API endpoints / hub methods / events involved

AuthRepository, AccountRepository; pages /login, /register, /verify-email, /forgot-password, /reset-password, /account

## Data model

Access token in memory only (`src/lib/auth/session-store.ts`); refresh cookie restores it on load.

## Business rules

- Short-lived access JWT; refresh token in httpOnly Secure SameSite cookie with rotation and reuse detection.
- Passwords hashed with Argon2id.
- Email through an EmailSender port (SMTP adapter); Mailpit locally.

## Current state (what works, what's missing, known issues)

Done: all account pages with validation, loading and error states; silent refresh on 401 with one retry; refreshes serialised across tabs with the Web Locks API; header account menu with sign-out.

## Changelog

- 2026-10-25: Feature documented (Phase 1 scaffolding).
- 2026-10-25: Implemented in Phase 2 (identity).
