# Feature: Ban system
Status: Not started
Last updated: 2026-10-25

## Purpose
Ban by account, device hash and IP/subnet; temporary or permanent; shadow bans.

## User stories / use cases
- As a moderator, I can remove abusive users quickly.

## API endpoints / hub methods / events involved
To be defined when implementation starts (planned for Phase 5).

## Data model
To be defined when implementation starts (planned for Phase 5).

## Business rules
- Ban cache in Redis checked on connect.
- Shadow-banned users only match each other.

## Current state (what works, what's missing, known issues)
Not started. Planned for Phase 5.

## Changelog
- 2026-10-25: Feature documented (Phase 1 scaffolding).
