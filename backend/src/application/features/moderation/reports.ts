import { type EntityId, newEntityId } from "../../../domain/common/entity.js";
import { fail, ok, type Result } from "../../../domain/common/result.js";
import { Report, type ReportCategory, type ReportParty } from "../../../domain/moderation/report.js";
import type { EventPublisher } from "../../abstractions/messaging/integration-event.js";
import type { RateLimiter } from "../../abstractions/rate-limiter.js";
import { PartnerBlocked } from "../chat/blocks.js";
import { isParticipant, type Participant, participantOf, partnerOf } from "../chat/chat-types.js";
import type { Matchmaker } from "../chat/matchmaker.js";
import { REPORTED_MESSAGE_COUNT, type RecentMessages } from "../chat/recent-messages.js";
import type { ChatSessionControl } from "../chat/session-control.js";
import type { Clock } from "../identity/ports.js";
import type { BanService } from "./bans.js";
import { ReportSubmitted } from "./events.js";
import { ModerationErrors } from "./moderation-errors.js";
import { DAY_MS, type ModerationPolicy } from "./moderation-policy.js";
import { type AccessIdentity, personalTargets } from "./network.js";
import type { EvidenceStore, ReportRepository } from "./ports.js";
import { isJpeg } from "./schemas.js";

export interface SubmitReportInput {
  readonly reporter: AccessIdentity;
  readonly sessionId: string;
  readonly category: ReportCategory;
  readonly note: string | null;
  readonly snapshot: Buffer | null;
}

export interface ReportDependencies {
  readonly matchmaker: Pick<Matchmaker, "findSession" | "block">;
  readonly sessions: ChatSessionControl;
  readonly recentMessages: RecentMessages;
  readonly reports: ReportRepository;
  readonly evidence: EvidenceStore;
  readonly bans: BanService;
  readonly rateLimiter: RateLimiter;
  readonly events: EventPublisher;
  readonly policy: ModerationPolicy;
  readonly clock: Clock;
}

const HOUR = 60 * 60_000;
const toParty = (participant: Participant): ReportParty => ({ ...participant });

/**
 * One-click report. The reporter is disconnected from the partner and blocks them at once; the
 * snapshot and the last messages become evidence with a retention deadline. Minor-safety reports
 * also suspend the reported person immediately, pending review.
 */
export class SubmitReport {
  constructor(private readonly deps: ReportDependencies) {}

  async execute(input: SubmitReportInput): Promise<Result<{ reportId: EntityId }>> {
    const { deps } = this;
    if (input.snapshot && !isJpeg(input.snapshot)) return fail(ModerationErrors.invalidSnapshot);
    if (!(await this.withinRateLimit(input.reporter))) return fail(ModerationErrors.tooManyReports);

    const session = await deps.matchmaker.findSession(input.sessionId);
    if (!session || !isParticipant(session, input.reporter.subjectId))
      return fail(ModerationErrors.sessionNotFound);
    if (await deps.reports.existsForSession(session.sessionId, input.reporter.subjectId))
      return fail(ModerationErrors.alreadyReported);

    const reporter = participantOf(session, input.reporter.subjectId);
    const reported = partnerOf(session, input.reporter.subjectId);

    await deps.sessions.endIfActive(reporter.subjectId, session.sessionId);
    await deps.matchmaker.block(reporter, reported);
    await deps.events.publish(PartnerBlocked, {
      blockerSubjectId: reporter.subjectId,
      blockerDeviceId: reporter.deviceId,
      blockedSubjectId: reported.subjectId,
      blockedDeviceId: reported.deviceId,
      blockedAt: deps.clock().toISOString(),
    });

    const now = deps.clock();
    const messages = (await deps.recentMessages.list(session.sessionId)).slice(-REPORTED_MESSAGE_COUNT);
    const hasEvidence = input.snapshot !== null || messages.length > 0;
    const report = Report.submit(
      {
        sessionId: session.sessionId,
        mode: session.mode,
        category: input.category,
        note: input.note,
        reporter: toParty(reporter),
        reported: toParty(reported),
        evidenceId: hasEvidence ? newEntityId() : null,
      },
      now,
    );

    if (report.evidenceId) {
      const retentionDays = report.isMinorSafety
        ? deps.policy.minorSafetyRetentionDays
        : deps.policy.evidenceRetentionDays;
      await deps.evidence.save({
        id: report.evidenceId,
        reportId: report.id,
        snapshot: input.snapshot ? { contentType: "image/jpeg", data: input.snapshot } : null,
        messages: messages.map((message) => ({
          from: message.senderSubjectId === reporter.subjectId ? "reporter" : "reported",
          text: message.text,
          sentAt: message.sentAt,
        })),
        createdAt: now,
        expiresAt: new Date(now.getTime() + retentionDays * DAY_MS),
      });
    }
    await deps.reports.add(report);

    if (report.isMinorSafety)
      await deps.bans.issueAutomatic(personalTargets(reported), "pending-review", null, report.id);

    await deps.events.publish(ReportSubmitted, { reportId: report.id });
    return ok({ reportId: report.id });
  }

  private async withinRateLimit(reporter: AccessIdentity): Promise<boolean> {
    const keys = [
      `moderation.report:subject:${reporter.subjectId}`,
      `moderation.report:device:${reporter.deviceId}`,
    ];
    const decisions = await Promise.all(
      keys.map((key) => this.deps.rateLimiter.consume(key, this.deps.policy.reportsPerHour, HOUR)),
    );
    return decisions.every((decision) => decision.allowed);
  }
}
