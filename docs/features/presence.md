# Feature: Presence and disconnect detection

Status: Not started
Last updated: 2026-10-25

## Purpose

Heartbeat-based presence so partners are notified immediately on tab close or network drop.

## User stories / use cases

- As a user, I know right away when my partner leaves.

## API endpoints / hub methods / events involved

To be defined when implementation starts (planned for Phase 3).

## Data model

To be defined when implementation starts (planned for Phase 3).

## Business rules

- Presence keys in Redis with short TTL refreshed by heartbeat.
- Socket.IO automatic reconnect with backoff on the client.

## Current state (what works, what's missing, known issues)

Not started. Planned for Phase 3.

## Changelog

- 2026-10-25: Feature documented (Phase 1 scaffolding).
