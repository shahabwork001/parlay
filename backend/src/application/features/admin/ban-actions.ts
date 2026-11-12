import type { EntityId } from "../../../domain/common/entity.js";
import { fail, ok, type Result } from "../../../domain/common/result.js";
import type { Ban, BanMode, BanReason, BanTarget } from "../../../domain/moderation/ban.js";
import type { Principal } from "../identity/ports.js";
import { networkHashes } from "../moderation/network.js";
import { type AdminContext, staffActor } from "./admin-context.js";
import { AdminErrors } from "./admin-errors.js";

const HOUR = 60 * 60_000;

export interface ManualBan {
  readonly accountId?: string;
  readonly deviceIds?: readonly string[];
  /** A raw IP address typed by staff; only its keyed hashes are stored. */
  readonly ip?: string;
  readonly includeSubnet: boolean;
  readonly mode: BanMode;
  readonly reason: BanReason;
  readonly durationHours: number | null;
  readonly message?: string;
}

/** A ban issued from the users screen, not from a report. */
export class IssueManualBan {
  constructor(private readonly context: AdminContext) {}

  async execute(staff: Principal, request: ManualBan): Promise<Result<Ban>> {
    const targets: BanTarget[] = [];
    if (request.accountId) targets.push({ kind: "account", value: request.accountId });
    for (const deviceId of request.deviceIds ?? []) targets.push({ kind: "device", value: deviceId });
    if (request.ip) {
      const hashes = networkHashes(request.ip, this.context.hasher);
      targets.push({ kind: "ip", value: hashes.networkHash });
      if (request.includeSubnet) targets.push({ kind: "subnet", value: hashes.subnetHash });
    }
    if (targets.length === 0) return fail(AdminErrors.noBanTargets);

    const ban = await this.context.bans.issue({
      targets,
      mode: request.mode,
      reason: request.reason,
      message: request.message?.trim() || null,
      source: "moderator",
      createdBy: staff.subjectId,
      durationMs: request.durationHours === null ? null : request.durationHours * HOUR,
    });
    // The BanIssued consumer audits every ban; this entry records who acted and from where.
    await this.context.audit.record({
      actor: staffActor(staff),
      action: "ban.issued_manually",
      target: { type: "ban", id: ban.id },
      metadata: {
        mode: ban.mode,
        reason: ban.reason,
        targets: targets.map((target) => target.kind).join(","),
      },
      at: this.context.clock(),
    });
    return ok(ban);
  }
}

export class LiftBan {
  constructor(private readonly context: AdminContext) {}

  async execute(staff: Principal, banId: EntityId): Promise<Result<Ban>> {
    const result = await this.context.bans.lift(banId, staff.subjectId);
    if (!result.ok)
      return fail(result.error.code === "ban.not_found" ? AdminErrors.banNotFound : AdminErrors.banNotActive);
    await this.context.audit.record({
      actor: staffActor(staff),
      action: "ban.lifted",
      target: { type: "ban", id: banId },
      at: this.context.clock(),
    });
    return result;
  }
}

export class DecideAppeal {
  constructor(private readonly context: AdminContext) {}

  async execute(staff: Principal, banId: EntityId, accept: boolean): Promise<Result<Ban>> {
    const result = await this.context.bans.decideAppeal(banId, accept, staff.subjectId);
    if (!result.ok)
      return fail(
        result.error.code === "ban.not_found" ? AdminErrors.banNotFound : AdminErrors.noPendingAppeal,
      );
    await this.context.audit.record({
      actor: staffActor(staff),
      action: accept ? "appeal.accepted" : "appeal.rejected",
      target: { type: "ban", id: banId },
      at: this.context.clock(),
    });
    return ok(result.value);
  }
}
