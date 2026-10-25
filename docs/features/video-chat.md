# Feature: Video chat

Status: Done
Last updated: 2026-10-25

## Purpose

Camera/mic permission flow, device picker, mirrored preview, mute/camera toggles, Next, Stop and a connection quality indicator.

## User stories / use cases

- As a user, I can video chat with a random partner and skip at any time.
- As a user, I can choose my camera and microphone.

## API endpoints / hub methods / events involved

- GET /api/v1/rtc/ice-servers - STUN and TURN servers with per-participant credentials (bearer)
- Socket.IO `rtc:signal` {description: {type, sdp}} or {candidate: {...}} - relayed only within a video session, 60 burst / 20 per second
- Socket.IO `media:state` {audio, video} - partner sees muted / camera off

## Data model

Video and audio never touch the server (peer to peer or relayed through coturn).

## Business rules

- Esc = Next, Enter focuses the message box (shortcuts shown subtly).
- Partner IP is never exposed; relay-only mode available.

## Current state (what works, what's missing, known issues)

Done: video sessions use the video queue, signaling relay and TURN credentials.

## Changelog

- 2026-10-25: Feature documented (Phase 1 scaffolding).
- 2026-10-26: Implemented in Phase 4 (video chat).
