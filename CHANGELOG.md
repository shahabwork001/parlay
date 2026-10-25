# Changelog

All notable changes to this project are documented here. Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/); versioning: [SemVer](https://semver.org/).

## [Unreleased]

### Added

- Phase 1 foundation: Next.js 16 App Router with Cache Components and Partial Prefetching, TypeScript strict, Tailwind CSS v4, shadcn/ui (Radix), TanStack Query, Zustand, React Hook Form + zod, SignalR client dependency.
- Design tokens: zinc neutrals with a single teal accent, light/dark/system themes, Geist (local font files), reduced-motion support.
- App shell: header with theme toggle, footer, skip link, not-found and error pages.
- Landing page: value proposition, ground rules, principles, start panel with interest tags and language selector (persisted).
- Public `/status` page backed by the API readiness endpoint.
- Typed `HttpClient` with ProblemDetails parsing and a repository layer; ESLint rule forbidding direct `fetch`.
- Security headers and CSP; standalone Docker image running as non-root.
- Tooling: ESLint + Prettier (Tailwind class sorting), Vitest + Testing Library, Playwright, GitHub Actions CI.
- Documentation: README, CLAUDE.md, architecture, API usage, security, ADRs, feature docs and FEATURES.md.
