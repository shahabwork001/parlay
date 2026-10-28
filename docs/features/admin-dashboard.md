# Feature: Admin dashboard

Status: Done
Last updated: 2026-10-25

## Purpose

Live online users, active sessions, queue length, matches/min, reports/hour, average match time and revenue.

## User stories / use cases

- As an admin, I can see the platform's health and activity at a glance.

## API endpoints / hub methods / events involved

Route /admin; `AdminDashboard`

## Data model

TanStack Query `admin/dashboard`, polled every 10 s.

## Business rules

- Metrics come from Redis counters and analytics aggregates, never from hot-path Mongo queries.

## Current state (what works, what's missing, known issues)

Done: stat grid and two bar charts (inline SVG, values also exposed to screen readers), link to the queue when reports are open.

## Changelog

- 2026-10-25: Feature documented (Phase 1 scaffolding).
- 2026-10-28: Implemented in Phase 6 (admin panel).
