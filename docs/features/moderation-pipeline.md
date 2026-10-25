# Feature: Server-side moderation pipeline

Status: Not started
Last updated: 2026-10-25

## Purpose

Reports and flagged frames are scored by a pluggable IContentClassifier in a worker and routed to the human review queue with priority.

## User stories / use cases

- As a moderator, the most severe reports reach me first.

## API endpoints / hub methods / events involved

To be defined when implementation starts (planned for Phase 5).

## Data model

To be defined when implementation starts (planned for Phase 5).

## Business rules

- Runs in the workers process via RabbitMQ.
- Ships a free local classifier implementation.

## Current state (what works, what's missing, known issues)

Not started. Planned for Phase 5.

## Changelog

- 2026-10-25: Feature documented (Phase 1 scaffolding).
