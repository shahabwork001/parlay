# Feature: Matchmaking

Status: Not started
Last updated: 2026-10-25

## Purpose

Pair waiting users in under one second (p95) using atomic Redis operations.

## User stories / use cases

- As a user, I am matched with someone quickly.
- As an operator, a user is never matched with two people at once.

## API endpoints / hub methods / events involved

To be defined when implementation starts (planned for Phase 3).

## Data model

To be defined when implementation starts (planned for Phase 3).

## Business rules

- Queues live in Redis; pairing uses a Lua script for atomicity.
- No MongoDB access on the hot path.
- Blocked pairs, shadow-banned and low-trust users are segregated.

## Current state (what works, what's missing, known issues)

Not started. Planned for Phase 3.

## Changelog

- 2026-10-25: Feature documented (Phase 1 scaffolding).
