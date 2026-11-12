import { TRUST_ADJUSTMENTS, trustKeys } from "../../../domain/moderation/trust.js";
import type {
  IntegrationEvent,
  IntegrationEventHandler,
} from "../../abstractions/messaging/integration-event.js";
import type { BlockRepository } from "../chat/blocks.js";
import type { Clock } from "../identity/ports.js";
import type { BanService } from "./bans.js";
import type { ModerationPolicy } from "./moderation-policy.js";
import { personalTargets } from "./network.js";
import type { ContentClassifier, EvidenceStore, ReportRepository, TrustStore } from "./ports.js";

const DAY_MS = 24 * 60 * 60_000;

export interface ScoringDependencies {
  readonly blocks?: BlockRepository;
  readonly reports: ReportRepository;
  readonly evidence: EvidenceStore;
  readonly classifier: ContentClassifier;
  readonly trust: TrustStore;
  readonly bans: BanService;
  readonly policy: ModerationPolicy;
  readonly clock: Clock;
}

/**
 * Moderation worker step for each new report: classify the evidence, set the review priority, lower
 * the reported person's trust, and suspend them when several different people reported them recently.
 * Idempotent: a report is scored once, so redelivered events change nothing.
 */
export class ScoreReport implements IntegrationEventHandler<{ reportId: string }> {
  constructor(private readonly deps: ScoringDependencies) {}

  async handle(event: IntegrationEvent<{ reportId: string }>): Promise<void> {
    const { deps } = this;
    const report = await deps.reports.getById(event.payload.reportId);
    if (!report || (await deps.reports.isScoringComplete(report.id))) return;
    await deps.blocks?.record({
      blockerSubjectId: report.reporter.subjectId,
      blockerDeviceId: report.reporter.deviceId,
      blockedSubjectId: report.reported.subjectId,
      blockedDeviceId: report.reported.deviceId,
      blockedAt: report.createdAt,
    });
    if (report.isMinorSafety && report.status === "pending-review")
      await deps.bans.issueAutomatic(personalTargets(report.reported), "pending-review", null, report.id);
    if (!report.scoredAt) {
      const evidence = report.evidenceId ? await deps.evidence.get(report.evidenceId) : null;
      const score = await deps.classifier.classify({
        image: evidence?.snapshot?.data ?? null,
        texts:
          evidence?.messages
            .filter((message) => message.from === "reported")
            .map((message) => message.text) ?? [],
      });

      const now = deps.clock();
      const reportedKeys = trustKeys(report.reported);
      const [reporterTrust, reportedTrust, lastDay] = await Promise.all([
        deps.trust.scoreOf(trustKeys(report.reporter)),
        deps.trust.scoreOf(reportedKeys),
        deps.reports.countAgainst(report.reported.subjectId, new Date(now.getTime() - DAY_MS)),
      ]);

      report.applyScore(
        score,
        { reporterTrust, reportedTrust, recentReportsAgainst: Math.max(0, lastDay.reports - 1) },
        now,
      );
      // A concurrent delivery already scored it.
      if (!(await deps.reports.update(report))) return;
    }
    await deps.trust.adjust(
      trustKeys(report.reported),
      TRUST_ADJUSTMENTS.reportReceived,
      `report:${report.id}`,
    );

    if (report.isMinorSafety || report.status !== "pending-review") {
      await deps.reports.completeScoring(report.id);
      return;
    }
    const recent = await deps.reports.countAgainst(
      report.reported.subjectId,
      new Date(deps.clock().getTime() - deps.policy.reportSuspensionWindowMs),
    );
    if (recent.distinctReporters >= deps.policy.reportSuspensionThreshold)
      await deps.bans.issueAutomatic(
        personalTargets(report.reported),
        "repeated-reports",
        deps.policy.automaticBanMs,
        report.id,
      );
    await deps.reports.completeScoring(report.id);
  }
}
