import { fail, ok, type Result } from "../../../domain/common/result.js";
import type { Role } from "../../../domain/identity/roles.js";
import { normalizeEmail, type User } from "../../../domain/identity/user.js";
import type { TextRules } from "../../../domain/moderation/text-rules.js";
import type { Principal } from "../identity/ports.js";
import { type AdminContext, staffActor } from "./admin-context.js";
import { AdminErrors } from "./admin-errors.js";

/**
 * Grants or changes staff roles (SuperAdmin only, enforced by the route). The person is signed out
 * everywhere, so their next session carries the new roles and must pass two-factor sign-in.
 */
export class SetStaffRoles {
  constructor(private readonly context: AdminContext) {}

  async execute(
    actor: Principal,
    target: { userId?: string; email?: string },
    roles: readonly Role[],
  ): Promise<Result<User>> {
    const { users } = this.context;
    const user = target.userId
      ? await users.getById(target.userId)
      : target.email
        ? await users.findByEmail(normalizeEmail(target.email))
        : null;
    if (!user) return fail(AdminErrors.userNotFound);
    if (user.id === actor.subjectId) return fail(AdminErrors.cannotChangeSelf);
    if (roles.length > 0 && !user.isEmailVerified) return fail(AdminErrors.emailNotVerified);
    if (
      user.roles.includes("SuperAdmin") &&
      !roles.includes("SuperAdmin") &&
      (await users.countWithRole("SuperAdmin")) <= 1
    )
      return fail(AdminErrors.lastSuperAdmin);

    const before = [...user.roles];
    user.setRoles(roles);
    if (!(await users.update(user))) return fail(AdminErrors.concurrentChange);
    await this.context.refreshTokens.revokeAllForSubject(user.id);

    await this.context.audit.record({
      actor: staffActor(actor),
      action: "staff.roles_changed",
      target: { type: "user", id: user.id },
      metadata: { from: before.join(",") || null, to: user.roles.join(",") || null },
      at: this.context.clock(),
    });
    return ok(user);
  }
}

export class UpdateTextRules {
  constructor(private readonly context: AdminContext) {}

  async execute(staff: Principal, rules: TextRules): Promise<TextRules> {
    const before = await this.context.textRules.current();
    const normalised: TextRules = {
      ...rules,
      maskedWords: unique(rules.maskedWords),
      blockedWords: unique(rules.blockedWords),
    };
    await this.context.textRules.save(normalised);
    await this.context.audit.record({
      actor: staffActor(staff),
      action: "rules.updated",
      target: { type: "rules", id: "text" },
      // Before/after summary; word lists are recorded as counts plus what was added or removed.
      metadata: {
        maskedWords: `${before.maskedWords.length} -> ${normalised.maskedWords.length}`,
        blockedWords: `${before.blockedWords.length} -> ${normalised.blockedWords.length}`,
        added: listChange(normalised, before).join(",") || null,
        removed: listChange(before, normalised).join(",") || null,
        removeLinks: normalised.removeLinks,
        removePhoneNumbers: normalised.removePhoneNumbers,
        removeSocialHandles: normalised.removeSocialHandles,
        maxRepeats: `${before.maxRepeats} -> ${normalised.maxRepeats}`,
      },
      at: this.context.clock(),
    });
    return normalised;
  }
}

/** Words in `from` that are not in `other`, across both lists (at most 50, for the audit entry). */
const listChange = (from: TextRules, other: TextRules) => {
  const known = new Set([...other.maskedWords, ...other.blockedWords]);
  return [...from.maskedWords, ...from.blockedWords].filter((word) => !known.has(word)).slice(0, 50);
};

const unique = (words: readonly string[]) =>
  [...new Set(words.map((word) => word.trim().toLowerCase()).filter(Boolean))].sort();
