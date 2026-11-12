# Feature: Ban system

Status: Done
Last updated: 2026-10-25

## Purpose

Ban by account, device hash and IP/subnet; temporary or permanent; shadow bans.

## User stories / use cases

- As a moderator, I can remove abusive users quickly.

## API endpoints / hub methods / events involved

`BanService` (issue, issueAutomatic, lift, checkAccess, warmCache); `BanRepository`, `BanCache`, `BanEnforcer` ports; connect error `moderation.banned`; event `moderation:banned`

## Data model

`bans`: targets [{kind: account | device | ip | subnet, value}], targetKeys, mode (full | shadow), reason, message, source, createdBy, reportId, createdAt, expiresAt (null = permanent), liftedAt, liftedBy, appeal. Redis `ban:{kind}:{value}` sorted sets.

## Business rules

- Ban cache in Redis checked on connect.
- Shadow-banned users only match each other.

## Current state (what works, what's missing, known issues)

Done: checked on socket connect and every search. Full bans emit `moderation:banned` and disconnect every socket in the matching rooms (via the Redis emitter, from API or workers). Shadow bans move the person to the shadow pool silently. IP and subnet (/24, /64) targets are keyed hashes. Cache written through and rebuilt at API start. Staff issuing and lifting arrives in Phase 6 (ADR 0013).

## Changelog

- 2026-10-25: Feature documented (Phase 1 scaffolding).
- 2026-10-28: Implemented in Phase 5 (moderation and safety).
