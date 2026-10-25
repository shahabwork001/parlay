# Feature: System health

Status: In progress
Last updated: 2026-10-25

## Purpose

Status of MongoDB, Redis, RabbitMQ, TURN and worker queues.

## User stories / use cases

- As an operator, I can see which dependency is failing.

## API endpoints / hub methods / events involved

To be defined when implementation starts (planned for Phase 6).

## Data model

To be defined when implementation starts (planned for Phase 6).

## Business rules

- Public /status shows component status only; the admin view adds queue depths and details.

## Current state (what works, what's missing, known issues)

Public /status page polls /health/ready every 15s with loading, error/retry and per-component states. Admin system-health view comes in Phase 6.

## Changelog

- 2026-10-25: Feature documented (Phase 1 scaffolding).
