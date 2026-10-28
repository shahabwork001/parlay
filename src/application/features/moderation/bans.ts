import type { EntityId } from "../../../domain/common/entity.js";
import { fail, ok, type Result } from "../../../domain/common/result.js";
import { Ban, type BanReason, type BanTarget, type NewBan } from "../../../domain/moderation/ban.js";
import type { EventPublisher } from "../../abstractions/messaging/integration-event.js";
import type { Clock } from "../identity/ports.js";
import { BanIssued } from "./events.js";
import { ModerationErrors } from "./moderation-errors.js";
import { type AccessIdentity, banTargetsFor } from "./network.js";
import type { BanCache, BanEnforcer, BanRepository } from "./ports.js";

export type AccessDecision =
  | { readonly status: "allowed" }
  | { readonly status: "shadow" }
  | { readonly status: "banned"; readonly banId: EntityId };

/**
 * Issues, lifts and checks bans. MongoDB is the source of truth; the Redis cache answers the hot-path
 * checks and is written through on every change (and rebuilt at startup).
 */
export class BanService {
  constructor(
    private readonly bans: BanRepository,
    private readonly cache: BanCache,
    private readonly enforcer: BanEnforcer,
    private readonly events: EventPublisher,
    private readonly clock: Clock,
  ) {}

  async issue(request: NewBan): Promise<Ban> {
    const now = this.clock();
    const ban = Ban.issue(request, now);
    await this.bans.add(ban);
    await this.cache.store(ban, now);
    // Shadow bans are silent: the person keeps chatting, just in the shadow pool from their next search.
    if (ban.mode === "full") await this.enforcer.enforce(ban.targets);
    await this.events.publish(BanIssued, {
      banId: ban.id,
      mode: ban.mode,
      reason: ban.reason,
      source: ban.source,
      createdBy: ban.createdBy,
      reportId: ban.reportId,
      targetKinds: ban.targets.map((target) => target.kind),
      expiresAt: ban.expiresAt?.toISOString() ?? null,
      issuedAt: now.toISOString(),
    });
    return ban;
  }

  /** Issues a temporary automatic ban unless the person is already fully banned. */
  async issueAutomatic(
    targets: readonly BanTarget[],
    reason: BanReason,
    durationMs: number | null,
    reportId: EntityId | null = null,
  ): Promise<Ban | null> {
    const cached = await this.cache.lookup(targets, this.clock());
    if (cached.some((entry) => entry.mode === "full")) return null;
    return this.issue({ targets, mode: "full", reason, source: "automatic", durationMs, reportId });
  }

  async lift(banId: EntityId, liftedBy: EntityId | null): Promise<Result<Ban>> {
    const ban = await this.bans.getById(banId);
    if (!ban) return fail(ModerationErrors.noActiveBan);
    if (ban.lift(liftedBy, this.clock())) return fail(ModerationErrors.noActiveBan);
    await this.bans.update(ban);
    await this.cache.remove(ban);
    return ok(ban);
  }

  async checkAccess(identity: AccessIdentity): Promise<AccessDecision> {
    const entries = await this.cache.lookup(banTargetsFor(identity), this.clock());
    const full = entries.find((entry) => entry.mode === "full");
    if (full) return { status: "banned", banId: full.banId };
    return entries.length > 0 ? { status: "shadow" } : { status: "allowed" };
  }

  /** Rebuilds the cache from the repository; safe to run on every start. */
  async warmCache(): Promise<number> {
    const now = this.clock();
    const active = await this.bans.listActive(now);
    for (const ban of active) await this.cache.store(ban, now);
    return active.length;
  }
}

/** What a banned person may see about their ban. Shadow bans never appear here. */
export interface BanView {
  readonly id: EntityId;
  readonly reason: BanReason;
  readonly message: string | null;
  readonly startedAt: Date;
  readonly expiresAt: Date | null;
  readonly appealable: boolean;
  readonly appeal: {
    readonly status: "pending" | "accepted" | "rejected";
    readonly submittedAt: Date;
  } | null;
}

const toView = (ban: Ban): BanView => ({
  id: ban.id,
  reason: ban.reason,
  message: ban.message,
  startedAt: ban.createdAt,
  expiresAt: ban.expiresAt,
  appealable: ban.isAppealable && ban.appeal === null,
  appeal: ban.appeal ? { status: ban.appeal.status, submittedAt: ban.appeal.submittedAt } : null,
});

/** The ban that matters most: permanent first, otherwise the one that lasts longest. */
function mostSevere(bans: readonly Ban[]): Ban | null {
  const full = bans.filter((ban) => ban.mode === "full");
  full.sort((a, b) => (b.expiresAt?.getTime() ?? Infinity) - (a.expiresAt?.getTime() ?? Infinity));
  return full[0] ?? null;
}

export class GetMyBan {
  constructor(
    private readonly bans: BanRepository,
    private readonly clock: Clock,
  ) {}

  async execute(identity: AccessIdentity): Promise<BanView | null> {
    const ban = mostSevere(await this.bans.findActive(banTargetsFor(identity), this.clock()));
    return ban ? toView(ban) : null;
  }
}

export class SubmitAppeal {
  constructor(
    private readonly bans: BanRepository,
    private readonly clock: Clock,
  ) {}

  async execute(identity: AccessIdentity, message: string): Promise<Result<BanView>> {
    const now = this.clock();
    const ban = mostSevere(await this.bans.findActive(banTargetsFor(identity), now));
    if (!ban) return fail(ModerationErrors.noActiveBan);

    const error = ban.submitAppeal(message, now);
    if (error === "ban.appeal_exists") return fail(ModerationErrors.appealExists);
    if (error === "ban.not_appealable") return fail(ModerationErrors.notAppealable);
    if (error) return fail(ModerationErrors.noActiveBan);

    if (!(await this.bans.update(ban))) return fail(ModerationErrors.appealExists);
    return ok(toView(ban));
  }
}
