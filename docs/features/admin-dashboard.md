# Feature: Admin dashboard

Status: Done
Last updated: 2026-10-25

## Purpose

Live online users, active sessions, queue length, matches/min, reports/hour, average match time and revenue.

## User stories / use cases

- As an admin, I can see the platform's health and activity at a glance.

## API endpoints / hub methods / events involved

GET /api/v1/admin/dashboard (`dashboard.view`); `GetDashboard`; `LiveStats` (`RedisLiveStats`), `MatchStatsRecorder`

## Data model

Redis `stats:matches:{minute}` and `stats:wait:{minute}` counters (2 h TTL); presence keys, queues and `mm:sessions` for live values; reports from MongoDB.

## Business rules

- Metrics come from Redis counters and analytics aggregates, never from hot-path Mongo queries.

## Current state (what works, what's missing, known issues)

Done: online now, waiting (text/video), active chats, matches per minute (60 min series), average wait of the earlier person (15 min), reports per hour (24 h series), open reports by tier, pending appeals. Every /api/v1/admin route needs its permission on a two-factor session (`requirePermission`). Revenue arrives with plans in Phase 7.

## Changelog

- 2026-10-25: Feature documented (Phase 1 scaffolding).
- 2026-10-28: Implemented in Phase 6 (admin panel).
