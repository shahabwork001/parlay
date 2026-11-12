import type { EntityId } from "../../../domain/common/entity.js";
import { fail, ok, type Result } from "../../../domain/common/result.js";
import { permissionsFor } from "../../../domain/identity/roles.js";
import type {
  IntegrationEvent,
  IntegrationEventHandler,
} from "../../abstractions/messaging/integration-event.js";
import type { Clock, Principal } from "../identity/ports.js";
import type { BanIssuedPayload } from "./events.js";
import { ModerationErrors } from "./moderation-errors.js";
import {
  type AuditLog,
  type Evidence,
  type EvidenceStore,
  type ReportRepository,
  SYSTEM_ACTOR,
} from "./ports.js";

export interface EvidenceView {
  readonly reportId: EntityId;
  readonly snapshot: string | null;
  readonly messages: readonly {
    readonly from: "reporter" | "reported";
    readonly text: string;
    readonly sentAt: Date;
  }[];
  readonly expiresAt: Date;
}

const toView = (evidence: Evidence): EvidenceView => ({
  reportId: evidence.reportId,
  snapshot: evidence.snapshot ? `data:image/jpeg;base64,${evidence.snapshot.data.toString("base64")}` : null,
  messages: evidence.messages,
  expiresAt: evidence.expiresAt,
});

/**
 * Report evidence for staff. Every access is written to the audit log before the evidence is
 * returned; minor-safety evidence additionally needs the escalation permission.
 */
export class GetReportEvidence {
  constructor(
    private readonly reports: ReportRepository,
    private readonly evidence: EvidenceStore,
    private readonly audit: AuditLog,
    private readonly clock: Clock,
  ) {}

  async execute(staff: Principal, reportId: EntityId): Promise<Result<EvidenceView>> {
    const report = await this.reports.getById(reportId);
    if (!report) return fail(ModerationErrors.reportNotFound);
    if (report.isMinorSafety && !permissionsFor(staff.roles).has("moderation.escalate"))
      return fail(ModerationErrors.escalationRequired);

    const evidence = report.evidenceId ? await this.evidence.get(report.evidenceId) : null;
    if (!evidence) return fail(ModerationErrors.evidenceExpired);

    await this.audit.record({
      actor: { kind: "staff", subjectId: staff.subjectId, roles: staff.roles },
      action: "evidence.viewed",
      target: { type: "report", id: report.id },
      metadata: { category: report.category, minorSafety: report.isMinorSafety },
      at: this.clock(),
    });
    return ok(toView(evidence));
  }
}

/** Automatic and staff bans both land in the audit log (staff actions also record their own entry in Phase 6). */
export class AuditBanIssued implements IntegrationEventHandler<BanIssuedPayload> {
  constructor(private readonly audit: AuditLog) {}

  async handle(event: IntegrationEvent<BanIssuedPayload>): Promise<void> {
    const ban = event.payload;
    await this.audit.record({
      id: `ban-issued:${ban.banId}`,
      actor:
        ban.source === "automatic" ? SYSTEM_ACTOR : { kind: "staff", subjectId: ban.createdBy, roles: [] },
      action: "ban.issued",
      target: { type: "ban", id: ban.banId },
      metadata: {
        mode: ban.mode,
        reason: ban.reason,
        reportId: ban.reportId,
        targets: ban.targetKinds.join(","),
        expiresAt: ban.expiresAt,
      },
      at: new Date(ban.issuedAt),
    });
  }
}
