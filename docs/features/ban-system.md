# Feature: Ban system

Status: Done
Last updated: 2026-10-25

## Purpose

Ban by account, device hash and IP/subnet; temporary or permanent; shadow bans.

## User stories / use cases

- As a moderator, I can remove abusive users quickly.

## API endpoints / hub methods / events involved

`useChat` ban handling; `/banned`

## Data model

None.

## Business rules

- Ban cache in Redis checked on connect.
- Shadow-banned users only match each other.

## Current state (what works, what's missing, known issues)

Done: a refused connection or a ban event during a chat sends the person to /banned.

## Changelog

- 2026-10-25: Feature documented (Phase 1 scaffolding).
- 2026-10-28: Implemented in Phase 5 (moderation and safety).
