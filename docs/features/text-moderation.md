# Feature: Text moderation

Status: Done
Last updated: 2026-10-25

## Purpose

Admin-editable word lists, regex rules for phone numbers / links / handles, and spam detection.

## User stories / use cases

- As a user, I am not exposed to slurs or spam.

## API endpoints / hub methods / events involved

`moderateText`, `RepeatGuard`, `TextRulesProvider` (`MongoTextRulesProvider`)

## Data model

`moderation_rules` document `text`: maskedWords, blockedWords, removeLinks, removePhoneNumbers, removeSocialHandles, maxRepeats, repeatWindowSeconds. Seeded from defaults; cached in process for 30 s.

## Business rules

- Rules live in MongoDB, are cached in Redis and invalidated via RabbitMQ.

## Current state (what works, what's missing, known issues)

Done: slurs reject the message (`chat.message_blocked`, trust -2); profanity is masked with bullets (rejected in low-trust and shadow pools); links, emails, phone numbers (7+ digits), @handles and "snap/insta/discord... name" become placeholders; leetspeak and stretched letters are normalised; the same message 4 times in 30 s is spam (`chat.spam`). Admin editing of the lists arrives in Phase 6.

## Changelog

- 2026-10-25: Feature documented (Phase 1 scaffolding).
- 2026-10-28: Implemented in Phase 5 (moderation and safety).
