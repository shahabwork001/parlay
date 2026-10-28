# Feature: System health

Status: Done
Last updated: 2026-10-25

## Purpose

Status of MongoDB, Redis, RabbitMQ, TURN and worker queues.

## User stories / use cases

- As an operator, I can see which dependency is failing.

## API endpoints / hub methods / events involved

Routes /status (public) and /admin/system; `SystemHealth`

## Data model

TanStack Query `admin/system`, polled every 15 s.

## Business rules

- Public /status shows component status only; the admin view adds queue depths and details.

## Current state (what works, what's missing, known issues)

Done: dependency cards and a queue table that highlights dead letters and queues without consumers.

## Changelog

- 2026-10-25: Feature documented (Phase 1 scaffolding).
- 2026-10-25: Public status page (Phase 1).
- 2026-10-28: Implemented in Phase 6 (admin panel).
