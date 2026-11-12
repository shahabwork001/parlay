import type { EntityId } from "../../../domain/common/entity.js";
import type { User } from "../../../domain/identity/user.js";
import type { PriorityTier, Report } from "../../../domain/moderation/report.js";
import { trustKeys } from "../../../domain/moderation/trust.js";
import { createPageRequest, type PagedResult } from "../../common/paging.js";
import { personalTargets } from "../moderation/network.js";
import type { AdminContext } from "./admin-context.js";
import type { BanSummary, SessionSummary } from "./admin-read-model.js";

const HOUR_COUNT = 24;
const MINUTE_COUNT = 60;

export interface ReportDetail {
  readonly report: Report;
  readonly reporterTrust: number;
  readonly reportedTrust: number;
  readonly reportedHistory: { readonly total: number; readonly upheld: number; readonly lastDay: number };
  readonly reporterHistory: { readonly total: number; readonly dismissed: number };
  readonly activeBans: PagedResult<BanSummary>["items"];
}

export class GetReportDetail {
  constructor(private readonly context: AdminContext) {}

  async execute(reportId: EntityId): Promise<ReportDetail | null> {
    const { context } = this;
    const report = await context.reports.getById(reportId);
    if (!report) return null;
    const now = context.clock();
    const [reporterTrust, reportedTrust, reportedHistory, reporterHistory, bans] = await Promise.all([
      context.trust.scoreOf(trustKeys(report.reporter)),
      context.trust.scoreOf(trustKeys(report.reported)),
      context.readModel.reportCounts(report.reported.subjectId, now),
      context.readModel.filedCounts(report.reporter.subjectId),
      context.banRepository.findActive(personalTargets(report.reported), now),
    ]);
    return {
      report,
      reporterTrust,
      reportedTrust,
      reportedHistory,
      reporterHistory,
      activeBans: bans.map((ban) => ({
        id: ban.id,
        targets: ban.targets,
        mode: ban.mode,
        reason: ban.reason,
        message: ban.message,
        source: ban.source,
        createdBy: ban.createdBy,
        reportId: ban.reportId,
        createdAt: ban.createdAt,
        expiresAt: ban.expiresAt,
        liftedAt: ban.liftedAt,
        appeal: ban.appeal,
      })),
    };
  }
}

export interface UserDetail {
  readonly user: User;
  readonly trust: number;
  readonly sessions: readonly SessionSummary[];
  readonly reportsAgainst: { readonly total: number; readonly upheld: number; readonly lastDay: number };
  readonly reportsFiled: { readonly total: number; readonly dismissed: number };
  readonly bans: PagedResult<BanSummary>;
}

export class GetUserDetail {
  constructor(private readonly context: AdminContext) {}

  async execute(userId: EntityId): Promise<UserDetail | null> {
    const { context } = this;
    const user = await context.users.getById(userId);
    if (!user) return null;
    const now = context.clock();
    const sessions = await context.readModel.userSessions(user.id, now);
    const deviceIds = [...new Set(sessions.map((session) => session.deviceId))];
    const [trust, reportsAgainst, reportsFiled, bans] = await Promise.all([
      context.trust.scoreOf([`user:${user.id}`, ...deviceIds.map((id) => `device:${id}`)]),
      context.readModel.reportCounts(user.id, now),
      context.readModel.filedCounts(user.id),
      context.readModel.listBans(
        { filter: "all", targetValue: user.id, page: createPageRequest(1, 20) },
        now,
      ),
    ]);
    return { user, trust, sessions, reportsAgainst, reportsFiled, bans };
  }
}

export interface Dashboard {
  readonly online: number;
  readonly waiting: { readonly text: number; readonly video: number };
  readonly activeSessions: number;
  readonly matchesPerMinute: readonly number[];
  readonly averageWaitMs: number | null;
  readonly reportsPerHour: readonly number[];
  readonly openReports: Record<PriorityTier, number>;
  readonly pendingAppeals: number;
  readonly generatedAt: Date;
}

export class GetDashboard {
  constructor(private readonly context: AdminContext) {}

  async execute(): Promise<Dashboard> {
    const { liveStats, readModel } = this.context;
    const now = this.context.clock();
    const [
      online,
      waiting,
      activeSessions,
      matchesPerMinute,
      averageWaitMs,
      reportsPerHour,
      openReports,
      pendingAppeals,
    ] = await Promise.all([
      liveStats.online(),
      liveStats.waiting(),
      liveStats.activeSessions(),
      liveStats.matchesPerMinute(MINUTE_COUNT, now),
      liveStats.averageWaitMs(15, now),
      readModel.reportsPerHour(HOUR_COUNT, now),
      readModel.openReportsByTier(),
      readModel.pendingAppeals(),
    ]);
    return {
      online,
      waiting,
      activeSessions,
      matchesPerMinute,
      averageWaitMs,
      reportsPerHour,
      openReports,
      pendingAppeals,
      generatedAt: now,
    };
  }
}
