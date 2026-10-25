# CLAUDE.md - Parley frontend

**After every change, update the affected feature doc and FEATURES.md before considering the task done.**
Also add an entry to `CHANGELOG.md` (Keep a Changelog) and, for significant technical choices, an ADR in `docs/decisions/`.

@AGENTS.md

This is Next.js 16 with Cache Components and Partial Prefetching. APIs differ from older versions; read `node_modules/next/dist/docs/` before using a Next.js API you are unsure about.

## Commands

```bash
npm run dev            # http://localhost:3000
npm run check          # lint + format check + typecheck + unit tests
npm run build          # production build (standalone output)
npm test               # Vitest
npm run test:e2e       # Playwright, frontend-only specs (builds and starts the app unless E2E_BASE_URL is set)
npm run test:e2e:stack # Playwright against the full Docker stack (API, workers, Mailpit)
npm run lock:refresh   # regenerate package-lock.json after adding or upgrading dependencies
```

Always run `npm run lock:refresh` after `npm install <package>`: npm on Windows drops other platforms' optional dependencies from the lockfile, which breaks `npm ci` in the Linux Docker build.

## Structure

```
src/app/                 routes only (thin). Route groups: (public), (chat), (account), (admin)
src/features/<feature>/  components, hooks, store, types for one feature
src/repositories/        one repository per backend resource; the only callers of HttpClient
src/services/            Socket.IO connection manager, WebRTC peer manager, media device manager
src/components/ui/       shadcn/ui primitives (generated; keep edits minimal)
src/components/shared/   shared composed components (header, footer, theme toggle)
src/lib/                 config, constants, zod schemas, http client, utils
e2e/                     Playwright specs
```

## Rules

- Server Components by default. Add `"use client"` only for interactivity, browser APIs or hooks.
- No business logic in `page.tsx` / `layout.tsx`: they compose feature components.
- Components never call `fetch`; ESLint enforces it. Use a repository, consumed through TanStack Query hooks.
- Validate every server response with zod in the repository.
- Zustand for lightweight client state only; server state belongs in TanStack Query. Persisted stores use `skipHydration` plus a hydrator to avoid hydration mismatches.
- Forms: React Hook Form + zod resolver; shared `FormField` and `ConsentCheckbox`; API field errors via `fieldErrors()`.
- Auth: the access token lives only in `src/lib/auth/session-store.ts` (memory). Never persist it. The HTTP client refreshes once on 401; `refreshSession()` is single-flight and serialised across tabs.
- Single-use tokens from links (verify email, reset password) must be submitted once, even under React Strict Mode.
- TypeScript strict, no `any`, no casts to silence errors, no dead or commented-out code.
- With Cache Components, do not read `new Date()`, `Math.random()` or request data during prerender outside `"use cache"` / Suspense boundaries.

## Design rules (must not look vibe-coded)

- Zinc neutrals plus one teal accent (`--primary`). All colours come from the CSS variables in `globals.css`; never hardcode hex values in components (status dots are the only semantic exception).
- Forbidden: gradients, glassmorphism, glows, emoji in copy, decorative blobs, icon spam, lorem ipsum, heavy shadows.
- Geist only. Spacing on the 4px grid (Tailwind scale). Restrained type scale.
- Every async state is designed: skeleton, empty, error with retry, searching.
- WCAG 2.1 AA: labels, focus rings, keyboard access, `aria-live` for status, reduced motion respected. Works at 360px width.

## Docs to keep current

`FEATURES.md`, `docs/features/<feature>.md`, `docs/architecture.md`, `docs/api.md`, `docs/security.md`, `docs/decisions/`, `CHANGELOG.md`.
