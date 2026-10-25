# Feature: WebRTC signaling and TURN

Status: Done
Last updated: 2026-10-25

## Purpose

Socket.IO-based offer/answer/ICE exchange with STUN/TURN via coturn and time-limited HMAC credentials.

## User stories / use cases

- As a user on a restrictive network, my call still connects through TURN.
- As a user, a dropped connection recovers automatically.

## API endpoints / hub methods / events involved

- GET /api/v1/rtc/ice-servers - STUN and TURN servers with per-participant credentials (bearer)
- Socket.IO `rtc:signal` {description: {type, sdp}} or {candidate: {...}} - relayed only within a video session, 60 burst / 20 per second
- Socket.IO `media:state` {audio, video} - partner sees muted / camera off

## Data model

None stored. TURN username = `<expiry>:<subject id>`, password = base64(HMAC-SHA1(TURN_SECRET, username)).

## Business rules

- TURN credentials: username = expiry:userId, password = HMAC-SHA1(secret, username), short TTL.
- ICE restart on connection failure.

## Current state (what works, what's missing, known issues)

Done: coturn runs with `use-auth-secret`; the API issues credentials valid for TURN_CREDENTIAL_TTL_SECONDS (1 h) and coturn validates them without calling the API. Signals are schema-checked (SDP up to 32 KB) and dropped outside video sessions. Verified end to end, including relay-only calls through coturn. Production needs a public TURN host, TLS (turns:) and private-range peer denial.

## Changelog

- 2026-10-25: Feature documented (Phase 1 scaffolding).
- 2026-10-26: Implemented in Phase 4 (video chat).
