# Feature: Age and terms gate

Status: Done
Last updated: 2026-10-25

## Purpose

Mandatory 18+ confirmation and Terms / Community Guidelines acceptance before any chat.

## User stories / use cases

- As a visitor, I must confirm I am 18+ and accept the terms before chatting.
- As an operator, I can prove when and which version a user accepted.

## API endpoints / hub methods / events involved

AuthRepository.startAnonymousSession, AccountRepository.acceptCurrentTerms

## Data model

`TERMS_VERSION` constant in `src/lib/legal.ts` (must match the API's `TERMS_VERSION`).

## Business rules

- Acceptance stores timestamp + terms version on the session/account.
- A new terms version requires re-acceptance.
- No chat hub connection without a valid acceptance.

## Current state (what works, what's missing, known issues)

Done: Start video/text open a dialog requiring both the 18+ confirmation and Terms acceptance (with links). Sessions that already accepted the current version go straight to chat; clicks during session restore wait for it. Chat routes arrive in Phase 3.

## Changelog

- 2026-10-25: Feature documented (Phase 1 scaffolding).
- 2026-10-25: Implemented in Phase 2 (identity).
