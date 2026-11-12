export const ROLES = ["SuperAdmin", "Admin", "Moderator", "Support"] as const;
export type Role = (typeof ROLES)[number];

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

/** Single source of truth for what each staff role may do. */
export const ROLE_PERMISSIONS: Record<Role, readonly Permission[]> = {
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

export const isRole = (value: string): value is Role => (ROLES as readonly string[]).includes(value);

export const isStaff = (roles: readonly Role[]): boolean => roles.length > 0;

export function permissionsFor(roles: readonly Role[]): ReadonlySet<Permission> {
  return new Set(roles.flatMap((role) => ROLE_PERMISSIONS[role]));
}
