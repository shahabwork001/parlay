# Feature: WebRTC signaling and TURN

Status: Done
Last updated: 2026-10-25

## Purpose

Socket.IO-based offer/answer/ICE exchange with STUN/TURN via coturn and time-limited HMAC credentials.

## User stories / use cases

- As a user on a restrictive network, my call still connects through TURN.
- As a user, a dropped connection recovers automatically.

## API endpoints / hub methods / events involved

`src/services/webrtc/peer-session.ts`, `RtcRepository.getIceServers`

## Data model

ICE servers cached in memory for 30 minutes.

## Business rules

- TURN credentials: username = expiry:userId, password = HMAC-SHA1(secret, username), short TTL.
- ICE restart on connection failure.

## Current state (what works, what's missing, known issues)

Done: perfect negotiation (callee is polite) so either side can renegotiate safely; signals arriving before the peer exists are buffered; ICE restart after 3 s disconnected or on failure; relay-only (iceTransportPolicy relay) when the privacy setting is on.

## Changelog

- 2026-10-25: Feature documented (Phase 1 scaffolding).
- 2026-10-26: Implemented in Phase 4 (video chat).
