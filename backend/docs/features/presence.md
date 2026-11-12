# Feature: Presence and disconnect detection

Status: Done
Last updated: 2026-10-25

## Purpose

Heartbeat-based presence so partners are notified immediately on tab close or network drop.

## User stories / use cases

- As a user, I know right away when my partner leaves.

## API endpoints / hub methods / events involved

Socket.IO `disconnect` handling; presence keys refreshed every 10 s; sweeper every 10 s

## Data model

`mm:presence:{subject}` with a 30 s TTL.

## Business rules

- Presence keys in Redis with short TTL refreshed by heartbeat.
- Socket.IO automatic reconnect with backoff on the client.

## Current state (what works, what's missing, known issues)

Done: closing a tab ends the chat and notifies the partner immediately (`match:ended` reason disconnected). Network drops are detected by Socket.IO heartbeats (10 s ping interval, 10 s timeout). If an API instance dies, a sweeper (one instance at a time via a Redis lease) ends sessions whose participant has no presence and clears stale queue tickets.

## Changelog

- 2026-10-25: Feature documented (Phase 1 scaffolding).
- 2026-10-25: Implemented in Phase 3 (matchmaking and text chat).
