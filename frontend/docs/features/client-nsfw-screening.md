# Feature: Client-side NSFW screening

Status: Done
Last updated: 2026-10-25

## Purpose

NSFWJS in a Web Worker screens the user's own stream; flagged streams are blurred to the partner and reported.

## User stories / use cases

- As a user, I am protected from unexpected explicit content.

## API endpoints / hub methods / events involved

`ContentScreener`, `ScreeningTracker`, `nsfw.worker.ts`, `createBlurredTrack`

## Data model

None. Frames stay on the device.

## Business rules

- Model is lazy-loaded.
- Repeated flags lead to an automatic temporary ban.

## Current state (what works, what's missing, known issues)

Done: NSFWJS MobileNetV2 in a Web Worker, loaded only when a video session starts; one frame every 3 s; flagged after 2 frames over the threshold, cleared after 3 under. While flagged the partner receives a 32 px canvas blur (replaceTrack) and the person sees a warning and "Blurred for your partner". Unsupported browsers or model failures turn screening off without breaking the call. See ADR 0008.

## Changelog

- 2026-10-25: Feature documented (Phase 1 scaffolding).
- 2026-10-28: Implemented in Phase 5 (moderation and safety).
