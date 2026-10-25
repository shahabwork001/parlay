# Feature: WebRTC signaling and TURN

Status: Not started
Last updated: 2026-10-25

## Purpose

SignalR-based offer/answer/ICE exchange with STUN/TURN via coturn and time-limited HMAC credentials.

## User stories / use cases

- As a user on a restrictive network, my call still connects through TURN.
- As a user, a dropped connection recovers automatically.

## API endpoints / hub methods / events involved

To be defined when implementation starts (planned for Phase 4).

## Data model

To be defined when implementation starts (planned for Phase 4).

## Business rules

- TURN credentials: username = expiry:userId, password = HMAC-SHA1(secret, username), short TTL.
- ICE restart on connection failure.

## Current state (what works, what's missing, known issues)

Not started. Planned for Phase 4.

## Changelog

- 2026-10-25: Feature documented (Phase 1 scaffolding).
