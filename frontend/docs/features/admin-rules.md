# Feature: Word lists and rules

Status: Done
Last updated: 2026-10-25

## Purpose

Edit blocked words, regex rules, thresholds and rate limits, applied live without redeploy.

## User stories / use cases

- As an admin, I can tighten rules immediately during an incident.

## API endpoints / hub methods / events involved

Route /admin/rules; `RulesEditor`

## Data model

TanStack Query `admin/rules/text`.

## Business rules

- Stored in Mongo, cached in Redis, invalidated via RabbitMQ event.

## Current state (what works, what's missing, known issues)

Done: blocked and masked word lists (one per line), removal toggles, repeat-spam limits.

## Changelog

- 2026-10-25: Feature documented (Phase 1 scaffolding).
- 2026-10-28: Implemented in Phase 6 (admin panel).
