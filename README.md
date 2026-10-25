# Parley frontend

Web client and admin panel for **Parley**, an anonymous random video and text chat platform for adults.
Next.js 16 (App Router, Cache Components), TypeScript strict, Tailwind CSS v4, shadcn/ui on Radix, TanStack Query, Zustand, Socket.IO client and native WebRTC.

Project state lives in [FEATURES.md](FEATURES.md). Architecture: [docs/architecture.md](docs/architecture.md).

## Prerequisites

- Node.js 24+ and npm 11+
- Docker Desktop (optional, for the container image and the full stack)
- A running Parley API (see `../backend`) for live data

## One-command setup

From the parent folder, `./scripts/dev-up.sh` starts the full stack (backend and frontend).

Frontend only:

```bash
./scripts/init-env.sh     # creates .env from .env.example (never overwrites)
npm ci
npm run dev               # http://localhost:3000
```

Container:

```bash
docker compose up -d --build   # http://localhost:3000
```

## Environment variables

| Variable                   | Default                 | Purpose                                                                                      |
| -------------------------- | ----------------------- | -------------------------------------------------------------------------------------------- |
| `NEXT_PUBLIC_API_BASE_URL` | `http://localhost:8080` | API origin as seen by the browser. Inlined at build time and added to the CSP `connect-src`. |
| `E2E_BASE_URL`             | empty                   | Run Playwright against an already running app instead of building one.                       |

## Scripts

| Script                                    | What it does                                                                       |
| ----------------------------------------- | ---------------------------------------------------------------------------------- |
| `npm run dev`                             | Development server                                                                 |
| `npm run build` / `npm start`             | Production build / server                                                          |
| `npm run lint` / `npm run lint:fix`       | ESLint (zero warnings allowed)                                                     |
| `npm run format` / `npm run format:check` | Prettier (with Tailwind class sorting)                                             |
| `npm run typecheck`                       | `tsc --noEmit`                                                                     |
| `npm test` / `npm run test:watch`         | Vitest + Testing Library                                                           |
| `npm run test:e2e`                        | Playwright frontend specs (run `npx playwright install chromium` once)             |
| `npm run test:e2e:stack`                  | Playwright against the running Docker stack (`E2E_BASE_URL=http://localhost:3000`) |
| `npm run lock:refresh`                    | Regenerate the lockfile from a clean install (run after adding dependencies)       |
| `npm run check`                           | Lint, format check, typecheck and unit tests                                       |

## Routes

| Route                                                                         | Description                                                                            |
| ----------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| `/`                                                                           | Landing page: value proposition, ground rules, start panel with interests and language |
| `/status`                                                                     | Public system status (polls the API readiness endpoint)                                |
| `/terms`, `/privacy`, `/guidelines`, `/safety`, `/faq`, `/contact`            | Static legal and help pages                                                            |
| `/login`, `/register`, `/verify-email`, `/forgot-password`, `/reset-password` | Account flows                                                                          |
| `/account`                                                                    | Email, Terms status and two-factor authentication                                      |
| `/chat/text`                                                                  | Random text chat (requires an accepted Terms gate)                                     |
| `/chat/video`                                                                 | Random video chat with camera preflight                                                |
| `/settings`                                                                   | Theme, default camera and microphone, relay-only video, match sound                    |
