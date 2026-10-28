import type { Role } from "@/lib/schemas/auth";

/**
 * Mirrors the backend's `src/domain/identity/roles.ts` (ROLE_PERMISSIONS). Used only to shape the
 * admin UI; every admin request is authorised again by the API.
 */
export const PERMISSIONS = [
  "dashboard.view",
  "reports.review",
  "moderation.act",
  "moderation.escalate",
  "users.view",
  "users.manage",
  "bans.manage",
  "appeals.review",
  "rules.manage",
  "plans.manage",
  "flags.manage",
  "staff.manage",
  "audit.view",
  "system.view",
] as const;
export type Permission = (typeof PERMISSIONS)[number];

const ROLE_PERMISSIONS: Record<Role, readonly Permission[]> = {
  SuperAdmin: PERMISSIONS,
  Admin: PERMISSIONS.filter((permission) => permission !== "staff.manage"),
  Moderator: [
    "dashboard.view",
    "reports.review",
    "moderation.act",
    "moderation.escalate",
    "users.view",
    "bans.manage",
    "appeals.review",
  ],
  Support: ["dashboard.view", "users.view", "appeals.review"],
};

export function permissionsFor(roles: readonly Role[]): ReadonlySet<Permission> {
  return new Set(roles.flatMap((role) => ROLE_PERMISSIONS[role]));
}
