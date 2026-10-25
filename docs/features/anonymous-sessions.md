# Feature: Anonymous sessions

Status: Not started
Last updated: 2026-10-25

## Purpose

Chat without an account using a device-bound, signed anonymous session.

## User stories / use cases

- As a visitor, I can chat without registering.
- As a moderator, bans still apply to anonymous users via their device.

## API endpoints / hub methods / events involved

To be defined when implementation starts (planned for Phase 2).

## Data model

To be defined when implementation starts (planned for Phase 2).

## Business rules

- Session token is signed by the API and bound to a device fingerprint hash.
- Raw fingerprints are never stored, only salted hashes.

## Current state (what works, what's missing, known issues)

Not started. Planned for Phase 2.

## Changelog

- 2026-10-25: Feature documented (Phase 1 scaffolding).
