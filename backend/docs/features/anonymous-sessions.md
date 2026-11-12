# Feature: Anonymous sessions

Status: Done
Last updated: 2026-10-25

## Purpose

Chat without an account using a device-bound, signed anonymous session.

## User stories / use cases

- As a visitor, I can chat without registering.
- As a moderator, bans still apply to anonymous users via their device.

## API endpoints / hub methods / events involved

- POST /api/v1/auth/anonymous
- POST /api/v1/auth/refresh (anonymous refresh families)

## Data model

Collection `users`: _id (UUID v7), email (unique, normalised), passwordHash (Argon2id), emailVerifiedAt, roles[], termsAcceptance {version, acceptedAt, ageConfirmed}, twoFactor {encryptedSecret (AES-256-GCM), enabledAt, recoveryCodeHashes[] (HMAC)}, failedLoginCount, lockedUntil, createdAt, version.
Collection `devices`: _id, fingerprintHash (HMAC of the client fingerprint, unique), firstSeenAt, lastSeenAt, termsAcceptance, version.
Collection `refresh_tokens`: _id = SHA-256(token), familyId, subjectKind, subjectId, deviceId, mfa, createdAt, expiresAt (TTL index), usedAt.
Collection `one_time_tokens`: _id = SHA-256(token), purpose (verify-email | reset-password), userId, expiresAt (TTL index).

## Business rules

- Session token is signed by the API and bound to a device fingerprint hash.
- Raw fingerprints are never stored, only salted hashes.

## Current state (what works, what's missing, known issues)

Done: anonymous principals are bound to a device whose fingerprint is stored only as an HMAC with a server secret. Same fingerprint, same device (race-safe via a unique index). Ban checks on the device arrive in Phase 5.

## Changelog

- 2026-10-25: Feature documented (Phase 1 scaffolding).
- 2026-10-25: Implemented in Phase 2 (identity).
