# Feature: Block and skip history

Status: Done
Last updated: 2026-10-25

## Purpose

Never re-match a user you blocked.

## User stories / use cases

- As a user, once I block someone I will never see them again.

## API endpoints / hub methods / events involved

Block button during a chat

## Data model

None.

## Business rules

- Blocks are checked during pairing.
- Blocks are keyed by account or device hash.

## Current state (what works, what's missing, known issues)

Done: one-click Block with a confirmation line in the conversation.

## Changelog

- 2026-10-25: Feature documented (Phase 1 scaffolding).
- 2026-10-25: Implemented in Phase 3 (matchmaking and text chat).
