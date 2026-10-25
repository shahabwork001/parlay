# Feature: Anonymous sessions

Status: Done
Last updated: 2026-10-25

## Purpose

Chat without an account using a device-bound, signed anonymous session.

## User stories / use cases

- As a visitor, I can chat without registering.
- As a moderator, bans still apply to anonymous users via their device.

## API endpoints / hub methods / events involved

AuthRepository.startAnonymousSession; `src/services/device-identity.ts`

## Data model

localStorage `parley.device-id` (random UUID). The fingerprint sent is SHA-256(id + stable browser traits).

## Business rules

- Session token is signed by the API and bound to a device fingerprint hash.
- Raw fingerprints are never stored, only salted hashes.

## Current state (what works, what's missing, known issues)

Done: created by the terms gate; restored on reload from the refresh cookie.

## Changelog

- 2026-10-25: Feature documented (Phase 1 scaffolding).
- 2026-10-25: Implemented in Phase 2 (identity).
