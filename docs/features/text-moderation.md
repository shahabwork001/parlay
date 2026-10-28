# Feature: Text moderation

Status: Done
Last updated: 2026-10-25

## Purpose

Admin-editable word lists, regex rules for phone numbers / links / handles, and spam detection.

## User stories / use cases

- As a user, I am not exposed to slurs or spam.

## API endpoints / hub methods / events involved

`useChat` send errors

## Data model

None.

## Business rules

- Rules live in MongoDB, are cached in Redis and invalidated via RabbitMQ.

## Current state (what works, what's missing, known issues)

Done: a rejected message is marked Not delivered with the server's explanation; filtered text replaces the optimistic copy.

## Changelog

- 2026-10-25: Feature documented (Phase 1 scaffolding).
- 2026-10-28: Implemented in Phase 5 (moderation and safety).
