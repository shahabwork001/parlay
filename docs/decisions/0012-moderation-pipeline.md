# 0012: Synchronous safety actions, asynchronous scoring, pluggable classifier

Status: Accepted (2026-10-28)

## Context

Reports, client-side content flags and rejected messages must protect people immediately, but scoring evidence (image and text classification) is slower and may later call a heavier model. The prompt requires a pluggable classifier with a free local implementation, and no paid services.

## Decision

- **On the request path** (API): everything that protects people now. A report ends the chat, blocks the partner, stores evidence and, for minor-safety categories, suspends the reported account and device pending review. Repeated on-device flags issue a temporary ban. Rejected messages never reach the partner.
- **In the workers** (RabbitMQ): everything that ranks and learns. `moderation.report-submitted.v1` triggers `ScoreReport`: classify evidence, compute priority (category base, classifier score, trust, recent reports), lower trust, and suspend after reports from several different people within an hour. Trust adjustments (`chat.session-ended.v1`, `moderation.content-flagged.v1`) and the audit trail (`moderation.ban-issued.v1`) are separate consumers.
- **`ContentClassifier` port** with `HeuristicContentClassifier` as the shipped implementation: a skin-tone pixel ratio for images (jpeg-js, pure JavaScript) and the text rules for messages. It only orders the review queue; no automatic action depends on it. A model-based classifier (for example NSFWJS on `@tensorflow/tfjs-node`, or a hosted API) can replace it in the composition root.
- Real nudity detection runs **on the device** (NSFWJS in the browser, see the frontend ADR 0008): it sees every frame, costs the platform nothing, and keeps video off the servers.

## Consequences

- A moderator never waits for a classifier to keep someone safe; scoring is idempotent (a report is scored once) and retried by the consumer.
- The heuristic image score is coarse (false positives on close-up faces, negatives in low light). That is acceptable for ordering a queue and is documented in the feature doc; swapping the classifier is a one-line change.
- Server-side image classification of every frame is impossible by design: media is peer-to-peer. Only report snapshots are ever classified on the server.
