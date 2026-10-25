# Feature: Accounts and authentication

Status: Not started
Last updated: 2026-10-25

## Purpose

Optional email/password accounts with verification, JWT access tokens and rotating refresh tokens.

## User stories / use cases

- As a user, I can register, verify my email, sign in and reset my password.
- As a user, my session survives page reloads securely.

## API endpoints / hub methods / events involved

To be defined when implementation starts (planned for Phase 2).

## Data model

To be defined when implementation starts (planned for Phase 2).

## Business rules

- Short-lived access JWT; refresh token in httpOnly Secure SameSite cookie with rotation and reuse detection.
- Passwords hashed with Argon2id.
- Email through an EmailSender port (SMTP adapter); Mailpit locally.

## Current state (what works, what's missing, known issues)

Not started. Planned for Phase 2.

## Changelog

- 2026-10-25: Feature documented (Phase 1 scaffolding).
