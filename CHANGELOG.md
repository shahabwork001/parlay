# Changelog

All notable changes to this project are documented here. Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/); versioning: [SemVer](https://semver.org/).

## [Unreleased]

### Added (Phase 2: identity)

- Static pages: Terms, Privacy, Community Guidelines, Safety tips, FAQ and Contact.
- Age and Terms gate on Start video/text, creating an anonymous device session or recording acceptance on the current session.
- Account pages: sign in (with authenticator or recovery code), register, confirm email, forgot and reset password, account settings with two-factor setup (QR code, recovery codes).
- In-memory session with silent refresh, single-flight and serialised across tabs (ADR 0007); header account menu.
- Device fingerprint service (SHA-256 of a stored random id and stable traits).
- Component tests for the gate, sign-in and error helpers; Playwright stack specs for the gate, registration with Mailpit, 2FA and password reset.
- `npm run lock:refresh` to keep the lockfile valid for the Linux Docker build.

### Changed

- Real-time client is `socket.io-client` instead of `@microsoft/signalr`, following the backend move to Node.js + Express with Socket.IO (frontend ADR 0006).

### Added

- Phase 1 foundation: Next.js 16 App Router with Cache Components and Partial Prefetching, TypeScript strict, Tailwind CSS v4, shadcn/ui (Radix), TanStack Query, Zustand, React Hook Form + zod.
- Design tokens: zinc neutrals with a single teal accent, light/dark/system themes, Geist (local font files), reduced-motion support.
- App shell: header with theme toggle, footer, skip link, not-found and error pages.
- Landing page: value proposition, ground rules, principles, start panel with interest tags and language selector (persisted).
- Public `/status` page backed by the API readiness endpoint.
- Typed `HttpClient` with ProblemDetails parsing and a repository layer; ESLint rule forbidding direct `fetch`.
- Security headers and CSP; standalone Docker image running as non-root.
- Tooling: ESLint + Prettier (Tailwind class sorting), Vitest + Testing Library, Playwright, GitHub Actions CI.
- Documentation: README, CLAUDE.md, architecture, API usage, security, ADRs, feature docs and FEATURES.md.
