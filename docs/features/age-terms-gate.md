# Feature: Age and terms gate
Status: Not started
Last updated: 2026-10-25

## Purpose
Mandatory 18+ confirmation and Terms / Community Guidelines acceptance before any chat.

## User stories / use cases
- As a visitor, I must confirm I am 18+ and accept the terms before chatting.
- As an operator, I can prove when and which version a user accepted.

## API endpoints / hub methods / events involved
To be defined when implementation starts (planned for Phase 2).

## Data model
To be defined when implementation starts (planned for Phase 2).

## Business rules
- Acceptance stores timestamp + terms version on the session/account.
- A new terms version requires re-acceptance.
- No chat hub connection without a valid acceptance.

## Current state (what works, what's missing, known issues)
Not started. Planned for Phase 2.

## Changelog
- 2026-10-25: Feature documented (Phase 1 scaffolding).
