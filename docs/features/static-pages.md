# Feature: Static pages

Status: Done
Last updated: 2026-10-25

## Purpose

Terms, Privacy, Community Guidelines, Safety tips, FAQ and Contact pages.

## User stories / use cases

- As a visitor, I can read the rules and privacy policy before using the service.
- As a visitor, I can find how to contact the operator.

## API endpoints / hub methods / events involved

None (static content). Contact addresses and the Terms version live in `src/lib/legal.ts`.

## Data model

None.

## Business rules

- Privacy page states that video and full chat logs are never stored.
- Terms disclose report snapshot capture.
- Terms and Guidelines are versioned; the gate records the accepted version.

## Current state (what works, what's missing, known issues)

Done: /terms, /privacy, /guidelines, /safety, /faq and /contact, statically prerendered, with a shared reading layout. The Privacy Policy states that video and full chat logs are never stored; the Terms disclose report snapshots. Contact addresses use the placeholder domain parley.example until the operator sets real ones.

## Changelog

- 2026-10-25: Feature documented (Phase 1 scaffolding).
- 2026-10-25: Implemented in Phase 2 (identity).
