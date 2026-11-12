# 0008: On-device NSFW screening in a Web Worker

Date: 2026-10-28. Status: Accepted.

## Context

Video goes peer to peer (or through TURN), so the server never sees it. The prompt asks for client-side pre-screening with a free model: blur the person's own stream for the partner when it is flagged, warn them, and tell the server so repeated flags lead to a ban. Classification must not freeze the call UI, and the model must not slow down pages that never start a video chat.

## Decision

- **Model**: NSFWJS 4 with its bundled MobileNetV2 (about 3.5 MB), running on TensorFlow.js. The model ships with the app as code-split chunks, so the CSP stays `self`-only and no frame or model request leaves the device.
- **Worker**: `src/services/safety/nsfw.worker.ts`, created with `new Worker(new URL(...), { type: "module" })` only when a video chat session starts. It receives an `ImageBitmap` (transferred, zero-copy), scales it to 224 px on an `OffscreenCanvas` and returns the class probabilities.
- **Sampling**: one frame every 3 seconds from the person's own camera (`ContentScreener`).
- **Decision** (`ScreeningTracker`): score = max(Porn, Hentai) + 0.5 × Sexy. Flag after 2 consecutive frames at or above the session's threshold; clear after 3 consecutive frames below it. The threshold comes from the server in `match:found` (0.75 standard, 0.55 in low-trust and shadow pools).
- **Blur**: while flagged, the outgoing video track is replaced (`RTCRtpSender.replaceTrack`, no renegotiation) with a canvas copy blurred at 32 px. The person's own tile shows "Blurred for your partner" and a warning explains why.
- **Report**: each new flag sends `moderation:flag` with the score. The server bans automatically after 3 flags in 10 minutes.
- **Failure**: if the browser lacks `Worker`, `OffscreenCanvas` or `createImageBitmap`, or the model fails three times, screening stops and the call continues. Reports and server-side moderation still apply.

## Consequences

- The main thread stays responsive. Classification costs roughly 50-150 ms per frame in the worker on a laptop (WebGL backend, CPU fallback).
- A determined person can disable client code. Screening protects partners from accidental or casual exposure; reports, trust and bans handle deliberate abuse.
- The model's error rate applies (false positives on skin-heavy scenes). The two-frame rule and a generous standard threshold keep false blurs rare, and a blur is reversible within about 9 seconds.
