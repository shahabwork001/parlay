# Feature: Payments

Status: Deferred
Last updated: 2026-10-25

## Purpose

IPaymentProvider abstraction with a fully working fake local provider (checkout, webhook, activation, expiry).

## User stories / use cases

- As an operator, I can add Stripe or Paddle later without touching business logic.

## API endpoints / hub methods / events involved

To be defined when implementation starts (planned for Phase 7).

## Data model

To be defined when implementation starts (planned for Phase 7).

## Business rules

- Webhooks are verified and idempotent.

## Current state (what works, what's missing, known issues)

Deferred (2026-10-28): Parley launches free to see how people respond (ADR 0015). Nothing is built yet; the design notes above stay as the plan for when a paid tier is added.

## Changelog

- 2026-10-25: Feature documented (Phase 1 scaffolding).
- 2026-10-28: Deferred; launch is free (ADR 0015).
