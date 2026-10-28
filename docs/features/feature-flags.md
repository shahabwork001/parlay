# Feature: Feature flags and site configuration

Status: Done
Last updated: 2026-10-25

## Purpose

Feature toggles, maintenance mode and announcement banner managed from the admin panel.

## User stories / use cases

- As an admin, I can enable maintenance mode or show an announcement instantly.

## API endpoints / hub methods / events involved

`useSiteConfig`, `SiteNotices`, `ChatUnavailable`; route /admin/site (`SiteSettings`)

## Data model

TanStack Query `site/config` (refreshed every minute; defaults until loaded).

## Business rules

- Cached in Redis, invalidated via RabbitMQ.

## Current state (what works, what's missing, known issues)

Done: announcement and maintenance notices under every header; start buttons disabled with an explanation when chat is paused; chat pages show a maintenance screen when the connection is refused; the sign-up page explains when new accounts are paused; admin editor with switches for maintenance and features and the banner text and tone.

## Changelog

- 2026-10-25: Feature documented (Phase 1 scaffolding).
- 2026-10-28: Implemented in Phase 7 (operator controls; monetisation deferred).
