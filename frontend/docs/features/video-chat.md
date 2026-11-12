# Feature: Video chat

Status: Done
Last updated: 2026-10-31

## Purpose

Camera/mic permission flow, device picker, mirrored preview, mute/camera toggles, Next, Stop and a connection quality indicator.

## User stories / use cases

- As a user, I can video chat with a random partner and skip at any time.
- As a user, I can choose my camera and microphone.

## API endpoints / hub methods / events involved

Route /chat/video; `useVideoCall`

## Data model

Settings store (camera, microphone, relay-only, match sound) in localStorage.

## Business rules

- Esc = Next, Enter focuses the message box (shortcuts shown subtly).
- Partner IP is never exposed; relay-only mode available.

## Current state (what works, what's missing, known issues)

Done: camera/mic preflight with mirrored preview, device pickers and clear errors (blocked, missing, busy, unsupported) with a text-chat fallback; two panes side by side on desktop and stacked on mobile; one control bar with Next (Esc), mute, camera, chat toggle, quality indicator (good/fair/poor with latency, loss and relay details), Block and Stop; collapsible chat panel; live device switching without renegotiation; partner camera-off state. NSFW screening (blur) arrives in Phase 5.

## Changelog

- 2026-10-31: Added an accessible Video settings dialog during calls: automatic/focus/equal-tile layouts, fit/fill framing, preview size/corner, show/hide self-view, local-only mirroring, live camera/microphone selection, supported full-screen entry/exit, and Reset view. View choices last for the current page/call flow; device choices retain the existing saved-device behavior. Primary camera/mic/chat/settings buttons have 44px touch targets. Escape closes settings without skipping. Hiding the preview leaves capture and screening running. Deployed phone interaction and accessibility checks passed; TURN passed on the preceding controls build. Physical multi-camera switching still requires device validation.

- 2026-10-31: Phone calls use a large main video and an inset self-preview. The preview's enlarge button swaps the main view without restarting media or matchmaking. Full camera frames are shown without cropping; phone preflight has a taller preview. Desktop retains side-by-side videos. Browser regression checks phone sizing, view swapping, full-frame fit and visible controls.

- 2026-10-25: Feature documented (Phase 1 scaffolding).
- 2026-10-26: Implemented in Phase 4 (video chat).
