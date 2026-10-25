# Feature: Presence and disconnect detection

Status: Done
Last updated: 2026-10-25

## Purpose

Heartbeat-based presence so partners are notified immediately on tab close or network drop.

## User stories / use cases

- As a user, I know right away when my partner leaves.

## API endpoints / hub methods / events involved

socket.io-client reconnection (0.5-5 s backoff with jitter)

## Data model

None.

## Business rules

- Presence keys in Redis with short TTL refreshed by heartbeat.
- Socket.IO automatic reconnect with backoff on the client.

## Current state (what works, what's missing, known issues)

Done: a dropped connection ends a live chat with a clear message; a search survives reconnection and rejoins automatically.

## Changelog

- 2026-10-25: Feature documented (Phase 1 scaffolding).
- 2026-10-25: Implemented in Phase 3 (matchmaking and text chat).
