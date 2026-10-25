# Feature: Text chat

Status: Done
Last updated: 2026-10-25

## Purpose

Real-time text chat over Socket.IO with typing indicator and delivery state.

## User stories / use cases

- As a user, I can exchange messages and see when my partner is typing.

## API endpoints / hub methods / events involved

`src/services/realtime/chat-connection.ts`, `useChat`, route /chat/[mode]

## Data model

Chat store (phase, messages, typing, end reason); nothing persisted.

## Business rules

- Messages are relayed, not stored (except the last N attached to a report).
- Profanity masking and link blocking by default (see text-moderation).

## Current state (what works, what's missing, known issues)

Done: searching, chatting, ended and stopped states; optimistic messages with sent/failed states; typing indicator (throttled to one signal per 2 s, auto-clears); Enter sends, Shift+Enter adds a line; Esc = Next; Block and Stop; automatic reconnection with token refresh. /chat/video currently runs the same text chat in the video queue until Phase 4 adds the video stage.

## Changelog

- 2026-10-25: Feature documented (Phase 1 scaffolding).
- 2026-10-25: Implemented in Phase 3 (matchmaking and text chat).
