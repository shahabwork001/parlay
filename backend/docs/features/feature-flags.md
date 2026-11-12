# Feature: Feature flags and site configuration

Status: Done
Last updated: 2026-10-25

## Purpose

Feature toggles, maintenance mode and announcement banner managed from the admin panel.

## User stories / use cases

- As an admin, I can enable maintenance mode or show an announcement instantly.

## API endpoints / hub methods / events involved

- GET /api/v1/site (public, cached 15 s): maintenance, announcement, features
- GET/PUT /api/v1/admin/site (`flags.manage`, 2FA)
- Connect error `site.maintenance`; ack errors `site.maintenance`, `chat.mode_disabled`; HTTP 403 `auth.registration_closed`

## Data model

`site_config` document `site`: maintenance {enabled, message}, announcement {message, tone info | warning} | null, features {textChat, videoChat, registration}, updatedAt, updatedBy.

## Business rules

- Cached in Redis, invalidated via RabbitMQ.

## Current state (what works, what's missing, known issues)

Done: maintenance refuses new socket connections and searches for everyone but staff (chats in progress finish normally); text and video chat can be switched off separately; registration can be closed (chatting without an account still works); a banner shows an announcement. Cached in process for 15 s and applied at once on the instance that saved it, instead of the Redis cache and RabbitMQ invalidation first planned: one small document read every 15 s per instance is cheaper and simpler (ADR 0015). Every change is audit-logged (`site.updated`).

## Changelog

- 2026-10-25: Feature documented (Phase 1 scaffolding).
- 2026-10-28: Implemented in Phase 7 (operator controls; monetisation deferred).
