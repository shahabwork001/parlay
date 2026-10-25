# Feature: Age and terms gate

Status: Done
Last updated: 2026-10-25

## Purpose

Mandatory 18+ confirmation and Terms / Community Guidelines acceptance before any chat.

## User stories / use cases

- As a visitor, I must confirm I am 18+ and accept the terms before chatting.
- As an operator, I can prove when and which version a user accepted.

## API endpoints / hub methods / events involved

- POST /api/v1/auth/anonymous and POST /api/v1/auth/register require `ageConfirmed: true` and the current `termsVersion`
- POST /api/v1/me/terms re-accepts after a Terms change
- GET /api/v1/legal/terms returns the current version
- Access tokens carry the accepted version (`tv` claim)

## Data model

`termsAcceptance { version, acceptedAt, ageConfirmed: true }` on users and devices.

## Business rules

- Acceptance stores timestamp + terms version on the session/account.
- A new terms version requires re-acceptance.
- No chat hub connection without a valid acceptance.

## Current state (what works, what's missing, known issues)

Done: acceptance is stored with timestamp and version; an outdated version is rejected with `terms.outdated`. The chat gateway (Phase 3) will refuse sessions whose `tv` claim is not current.

## Changelog

- 2026-10-25: Feature documented (Phase 1 scaffolding).
- 2026-10-25: Implemented in Phase 2 (identity).
