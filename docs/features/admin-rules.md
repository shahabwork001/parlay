# Feature: Word lists and rules

Status: Done
Last updated: 2026-10-25

## Purpose

Edit blocked words, regex rules, thresholds and rate limits, applied live without redeploy.

## User stories / use cases

- As an admin, I can tighten rules immediately during an incident.

## API endpoints / hub methods / events involved

GET/PUT /api/v1/admin/rules/text (`rules.manage`); `UpdateTextRules`; `TextRulesRepository`

## Data model

`moderation_rules` document `text` (see Text moderation).

## Business rules

- Stored in Mongo, cached in Redis, invalidated via RabbitMQ event.

## Current state (what works, what's missing, known issues)

Done: lists are trimmed, lowercased, de-duplicated and sorted; saved rules apply on this instance at once and on others within 30 s; audit-logged.

## Changelog

- 2026-10-25: Feature documented (Phase 1 scaffolding).
- 2026-10-28: Implemented in Phase 6 (admin panel).
