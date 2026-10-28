# 0009: Admin area as a client-rendered route group with a permission mirror

Date: 2026-10-28. Status: Accepted.

## Context

Staff screens depend entirely on the signed-in staff member (roles, two-factor session) and on fresh data. The access token lives only in memory (ADR 0007), so the server cannot render staff data. The prompt asks for route guards on the frontend and permission-based authorisation on the backend, and for the admin bundle to be split from the public site.

## Decision

- `src/app/(admin)/admin/*` is its own route group with its own header and layout. Pages are thin server components that render client components; Next splits the admin bundle from the public pages automatically.
- `AdminShell` guards the area: sign-in, staff role and a two-factor session are required, each with its own explanation. It sits inside a Suspense boundary because it reads the pathname on dynamic admin routes.
- `src/lib/permissions.ts` mirrors the backend role map. Navigation, sections (`RequirePermission`) and actions are shown only when permitted. The API checks every request again, so the mirror can only hide things, never grant them.
- All admin data goes through `AdminRepository` with zod-validated responses and TanStack Query (polling for the dashboard, queue and system view).
- Fast review: single-key shortcuts (`useShortcuts`) that ignore typing and open dialogs.

## Consequences

- No staff data is ever rendered on the server or cached by Next.
- The role map exists twice; a change to roles must update both (noted in both files and in `docs/features/roles-permissions.md`).
- First paint of the admin area shows a skeleton until the session is restored; acceptable for an internal tool.
