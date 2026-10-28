import type { EntityId } from "../../../domain/common/entity.js";
import { fail, ok, type Result } from "../../../domain/common/result.js";
import { permissionsFor } from "../../../domain/identity/roles.js";
import type { BanReason, BanTarget } from "../../../domain/moderation/ban.js";
import type { Report, ReportCategory } from "../../../domain/moderation/report.js";
import { TRUST_ADJUSTMENTS, trustKeys } from "../../../domain/moderation/trust.js";
import type { Principal } from "../identity/ports.js";
import { personalTargets } from "../moderation/network.js";
import { type AdminContext, staffActor } from "./admin-context.js";
import { AdminErrors } from "./admin-errors.js";

const HOUR = 60 * 60_000;

export const DEFAULT_WARNING =
  "A moderator reviewed a report about you. Please follow the Community Guidelines; further reports can lead to a ban.";

export type ReportDecision =
  | { readonly action: "dismiss"; readonly note?: string }
  | { readonly action: "warn"; readonly note?: string; readonly message?: string }
  | {
      readonly action: "ban";
      readonly mode: "full" | "shadow";
      /** null for a permanent ban. */
      readonly durationHours: number | null;
      /** Also ban the IP address and subnet the person used in this chat. */
      readonly includeNetwork: boolean;
      readonly message?: string;
      readonly note?: string;
    };

const BAN_REASON_FOR: Record<ReportCategory, BanReason> = {
  nudity: "nudity",
  "sexual-content": "sexual-content",
  harassment: "harassment",
  hate: "hate",
  violence: "violence",
  "self-harm": "other",
  scam: "scam",
  spam: "spam",
  "appears-minor": "underage",
  "child-sexual-content": "minor-safety",
  other: "other",
};

const canEscalate = (staff: Principal) => permissionsFor(staff.roles).has("moderation.escalate");

/**
 * A moderator's decision on a report. Lifts the automatic pending-review suspension it caused,
 * applies the warning or ban, adjusts trust (upheld: reported person; dismissed: reporter) and
 * writes the audit entry.
 */
export class DecideReport {
  constructor(private readonly context: AdminContext) {}

  async execute(staff: Principal, reportId: EntityId, decision: ReportDecision): Promise<Result<Report>> {
    const { context } = this;
    const report = await context.reports.getById(reportId);
    if (!report) return fail(AdminErrors.reportNotFound);
    if (report.isMinorSafety && !canEscalate(staff)) return fail(AdminErrors.escalationPermission);

    const now = context.clock();
    const outcome =
      decision.action === "dismiss" ? "dismissed" : decision.action === "warn" ? "warned" : "banned";
    if (report.resolve(outcome, staff.subjectId, decision.note?.trim() || null, now))
      return fail(AdminErrors.alreadyResolved);
    if (outcome === "dismissed" && report.escalation === "required")
      report.recordEscalation("not-required", null);
    if (!(await context.reports.update(report))) return fail(AdminErrors.concurrentChange);

    const targets = personalTargets(report.reported);
    const suspensions = (await context.banRepository.findActive(targets, now)).filter(
      (ban) => ban.reportId === report.id && ban.reason === "pending-review",
    );
    for (const suspension of suspensions) await context.bans.lift(suspension.id, staff.subjectId);

    if (decision.action === "warn") {
      await context.notifier.warn(targets, decision.message?.trim() || DEFAULT_WARNING);
    }
    if (decision.action === "ban") {
      const network: BanTarget[] = decision.includeNetwork
        ? [
            { kind: "ip", value: report.reported.networkHash },
            { kind: "subnet", value: report.reported.subnetHash },
          ].filter((target): target is BanTarget => target.value !== "")
        : [];
      await context.bans.issue({
        targets: [...targets, ...network],
        mode: decision.mode,
        reason: BAN_REASON_FOR[report.category],
        message: decision.message?.trim() || null,
        source: "moderator",
        createdBy: staff.subjectId,
        reportId: report.id,
        durationMs: decision.durationHours === null ? null : decision.durationHours * HOUR,
      });
    }

    if (report.isUpheld)
      await context.trust.adjust(trustKeys(report.reported), TRUST_ADJUSTMENTS.reportUpheld);
    else await context.trust.adjust(trustKeys(report.reporter), TRUST_ADJUSTMENTS.reportRejected);

    await context.audit.record({
      actor: staffActor(staff),
      action: "report.decided",
      target: { type: "report", id: report.id },
      metadata: {
        outcome,
        category: report.category,
        banMode: decision.action === "ban" ? decision.mode : null,
        durationHours: decision.action === "ban" ? decision.durationHours : null,
        includeNetwork: decision.action === "ban" ? decision.includeNetwork : null,
        liftedSuspensions: suspensions.length,
      },
      at: now,
    });
    return ok(report);
  }
}

export interface EscalationRecord {
  readonly status: "reported" | "not-required";
  readonly reference?: string;
}

/** The minor-safety escalation step: record that the report went to an authority (or why not). */
export class RecordEscalation {
  constructor(private readonly context: AdminContext) {}

  async execute(staff: Principal, reportId: EntityId, record: EscalationRecord): Promise<Result<Report>> {
    const reference = record.reference?.trim() || null;
    if (record.status === "reported" && !reference) return fail(AdminErrors.referenceRequired);

    const report = await this.context.reports.getById(reportId);
    if (!report) return fail(AdminErrors.reportNotFound);
    if (report.recordEscalation(record.status, reference)) return fail(AdminErrors.escalationNotApplicable);
    if (!(await this.context.reports.update(report))) return fail(AdminErrors.concurrentChange);

    await this.context.audit.record({
      actor: staffActor(staff),
      action: "report.escalated",
      target: { type: "report", id: report.id },
      metadata: { status: record.status, reference },
      at: this.context.clock(),
    });
    return ok(report);
  }
}
