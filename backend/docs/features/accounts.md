# Feature: Accounts and authentication

Status: Done
Last updated: 2026-10-25

## Purpose

Optional email/password accounts with verification, JWT access tokens and rotating refresh tokens.

## User stories / use cases

- As a user, I can register, verify my email, sign in and reset my password.
- As a user, my session survives page reloads securely.

## API endpoints / hub methods / events involved

- POST /api/v1/auth/anonymous - start an anonymous device session (18+ and Terms gate)
- POST /api/v1/auth/register - register (always 202, no account enumeration)
- POST /api/v1/auth/verify-email, POST /api/v1/auth/resend-verification
- POST /api/v1/auth/login - email/password, plus totpCode or recoveryCode when 2FA is on
- POST /api/v1/auth/refresh - rotate the refresh cookie, new access token
- POST /api/v1/auth/logout
- POST /api/v1/auth/password/forgot, POST /api/v1/auth/password/reset
- GET /api/v1/me, POST /api/v1/me/terms
- POST /api/v1/me/two-factor/setup, POST /api/v1/me/two-factor/confirm
- GET /api/v1/legal/terms
- Event: notifications.email-requested.v1 (API -> workers -> SMTP)

## Data model

Collection `users`: _id (UUID v7), email (unique, normalised), passwordHash (Argon2id), emailVerifiedAt, roles[], termsAcceptance {version, acceptedAt, ageConfirmed}, twoFactor {encryptedSecret (AES-256-GCM), enabledAt, recoveryCodeHashes[] (HMAC)}, failedLoginCount, lockedUntil, createdAt, version.
Collection `devices`: _id, fingerprintHash (HMAC of the client fingerprint, unique), firstSeenAt, lastSeenAt, termsAcceptance, version.
Collection `refresh_tokens`: _id = SHA-256(token), familyId, subjectKind, subjectId, deviceId, mfa, createdAt, expiresAt (TTL index), usedAt.
Collection `one_time_tokens`: _id = SHA-256(token), purpose (verify-email | reset-password), userId, expiresAt (TTL index).

## Business rules

- Short-lived access JWT; refresh token in httpOnly Secure SameSite cookie with rotation and reuse detection.
- Passwords hashed with Argon2id.
- Email through an EmailSender port (SMTP adapter); Mailpit locally.

## Current state (what works, what's missing, known issues)

Done: registration without enumeration, email verification (24 h link), sign-in with lockout (5 failures, 15 min) and timing equalisation, 15-minute JWT access tokens, rotating refresh tokens in an httpOnly Secure SameSite=Strict cookie scoped to /api/v1/auth with reuse detection (5 s grace for concurrent tabs), password reset (1 h, single use, signs out everywhere), email delivery through RabbitMQ and SMTP (Mailpit locally). Per-IP rate limits on every auth endpoint.

## Changelog

- 2026-10-25: Feature documented (Phase 1 scaffolding).
- 2026-10-25: Implemented in Phase 2 (identity).
