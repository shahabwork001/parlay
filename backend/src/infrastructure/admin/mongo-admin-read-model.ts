import type { Collection, Db, Document, Filter } from "mongodb";
import type {
  AdminReadModel,
  AuditListQuery,
  BanListQuery,
  BanSummary,
  ReportListQuery,
  ReportSummary,
  SessionSummary,
  StoredAuditEntry,
  UserSort,
  UserSummary,
} from "../../application/features/admin/admin-read-model.js";
import { type PagedResult, type PageRequest, toPagedResult } from "../../application/common/paging.js";
import type { Role } from "../../domain/identity/roles.js";
import type { PriorityTier } from "../../domain/moderation/report.js";

const HOUR = 60 * 60_000;
const DAY = 24 * HOUR;

/** Fields the projections read; every other document field stays out of the admin API. */
interface ReportProjection {
  _id: string;
  category: ReportSummary["category"];
  note: string | null;
  mode: ReportSummary["mode"];
  tier: PriorityTier;
  priority: number;
  status: ReportSummary["status"];
  resolution?: { outcome: ReportSummary["outcome"] } | null;
  escalation: ReportSummary["escalation"];
  evidenceId: string | null;
  score: { labels: string[] } | null;
  reported: { kind: "user" | "anonymous" };
  createdAt: Date;
}

interface BanProjection extends Omit<BanSummary, "id"> {
  _id: string;
}

interface UserProjection {
  _id: string;
  email: string;
  roles: Role[];
  emailVerifiedAt: Date | null;
  twoFactor: { enabledAt: Date | null } | null;
  createdAt: Date;
}

interface AuditProjection extends Omit<StoredAuditEntry, "id"> {
  _id: string;
}

const escapeRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const toReportSummary = (document: ReportProjection): ReportSummary => ({
  id: document._id,
  category: document.category,
  notePreview: document.note ? document.note.slice(0, 80) : null,
  mode: document.mode,
  tier: document.tier,
  priority: document.priority,
  status: document.status,
  outcome: document.resolution?.outcome ?? null,
  escalation: document.escalation,
  hasEvidence: document.evidenceId !== null,
  labels: document.score?.labels ?? [],
  reportedKind: document.reported.kind,
  createdAt: document.createdAt,
});

const toBanSummary = ({ _id, ...ban }: BanProjection): BanSummary => ({
  id: _id,
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
  appeal: ban.appeal
    ? { message: ban.appeal.message, status: ban.appeal.status, submittedAt: ban.appeal.submittedAt }
    : null,
});

const toUserSummary = (document: UserProjection): UserSummary => ({
  id: document._id,
  email: document.email,
  roles: document.roles,
  emailVerified: document.emailVerifiedAt !== null,
  twoFactorEnabled: document.twoFactor?.enabledAt != null,
  createdAt: document.createdAt,
});

const USER_FIELDS = { email: 1, roles: 1, emailVerifiedAt: 1, "twoFactor.enabledAt": 1, createdAt: 1 };

export class MongoAdminReadModel implements AdminReadModel {
  constructor(private readonly database: Db) {}

  private get reports() {
    return this.database.collection<ReportProjection>("reports");
  }

  private get bans() {
    return this.database.collection<BanProjection>("bans");
  }

  private get users() {
    return this.database.collection<UserProjection>("users");
  }

  async listReports(query: ReportListQuery): Promise<PagedResult<ReportSummary>> {
    const filter: Filter<ReportProjection> = {};
    if (query.status === "open") filter.status = "pending-review";
    if (query.status === "resolved") filter.status = { $in: ["dismissed", "actioned"] };
    if (query.tier) filter.tier = query.tier;
    if (query.reportedSubjectId) filter["reported.subjectId"] = query.reportedSubjectId;
    // Open reports: most urgent first, oldest first within a priority. Resolved: most recent first.
    const order = query.sort ?? (query.status === "open" ? "priority" : "newest");
    const sort: Document =
      order === "priority" ? { priority: -1, createdAt: 1 } : { createdAt: order === "oldest" ? 1 : -1 };
    return this.page(this.reports, filter, sort, query.page, toReportSummary);
  }

  async reportCounts(subjectId: string, now: Date) {
    const base = { "reported.subjectId": subjectId };
    const [total, upheld, lastDay] = await Promise.all([
      this.reports.countDocuments(base),
      this.reports.countDocuments({ ...base, "resolution.outcome": { $in: ["warned", "banned"] } }),
      this.reports.countDocuments({ ...base, createdAt: { $gte: new Date(now.getTime() - DAY) } }),
    ]);
    return { total, upheld, lastDay };
  }

  async filedCounts(subjectId: string) {
    const base = { "reporter.subjectId": subjectId };
    const [total, dismissed] = await Promise.all([
      this.reports.countDocuments(base),
      this.reports.countDocuments({ ...base, "resolution.outcome": "dismissed" }),
    ]);
    return { total, dismissed };
  }

  async listBans(query: BanListQuery, now: Date): Promise<PagedResult<BanSummary>> {
    const filter: Document = {};
    if (query.filter === "active") {
      filter.liftedAt = null;
      filter.$or = [{ expiresAt: null }, { expiresAt: { $gt: now } }];
    }
    if (query.filter === "appeals") filter["appeal.status"] = "pending";
    if (query.targetValue) filter["targets.value"] = query.targetValue;
    const sort: Document = query.filter === "appeals" ? { "appeal.submittedAt": 1 } : { createdAt: -1 };
    return this.page(this.bans, filter, sort, query.page, toBanSummary);
  }

  async searchUsers(
    query: string,
    page: PageRequest,
    sort: UserSort = "newest",
  ): Promise<PagedResult<UserSummary>> {
    const term = query.trim().toLowerCase();
    const filter: Filter<UserProjection> = term
      ? { $or: [{ _id: term }, { email: { $regex: escapeRegex(term) } }] }
      : {};
    const [documents, total] = await Promise.all([
      this.users
        .find(filter, { projection: USER_FIELDS })
        .sort(sort === "email" ? { email: 1 } : { createdAt: sort === "oldest" ? 1 : -1 })
        .skip(page.skip)
        .limit(page.pageSize)
        .toArray(),
      this.users.countDocuments(filter),
    ]);
    return toPagedResult(documents.map(toUserSummary), page, total);
  }

  async userSessions(userId: string, now: Date): Promise<SessionSummary[]> {
    const families = await this.database
      .collection("refresh_tokens")
      .aggregate<{
        _id: string;
        deviceId: string;
        mfa: boolean;
        startedAt: Date;
        lastActiveAt: Date;
        active: number;
      }>([
        { $match: { subjectId: userId } },
        {
          $group: {
            _id: "$familyId",
            deviceId: { $last: "$deviceId" },
            mfa: { $max: "$mfa" },
            startedAt: { $min: "$createdAt" },
            lastActiveAt: { $max: "$createdAt" },
            active: {
              $sum: { $cond: [{ $and: [{ $eq: ["$usedAt", null] }, { $gt: ["$expiresAt", now] }] }, 1, 0] },
            },
          },
        },
        { $sort: { lastActiveAt: -1 } },
        { $limit: 50 },
      ])
      .toArray();
    return families.map((family) => ({
      familyId: family._id,
      deviceId: family.deviceId,
      mfa: family.mfa,
      startedAt: family.startedAt,
      lastActiveAt: family.lastActiveAt,
      active: family.active > 0,
    }));
  }

  async listStaff(): Promise<UserSummary[]> {
    const documents = await this.users
      .find({ "roles.0": { $exists: true } }, { projection: USER_FIELDS })
      .sort({ email: 1 })
      .toArray();
    return documents.map(toUserSummary);
  }

  async listAudit(query: AuditListQuery): Promise<PagedResult<StoredAuditEntry>> {
    const filter: Document = {};
    if (query.action) filter.action = query.action;
    if (query.actorId) filter["actor.subjectId"] = query.actorId;
    if (query.targetId) filter["target.id"] = query.targetId;
    return this.page(
      this.database.collection<AuditProjection>("audit_log"),
      filter,
      { at: query.order === "oldest" ? 1 : -1 },
      query.page,
      ({ _id, ...entry }) => ({ ...entry, id: _id }),
    );
  }

  async reportsPerHour(hours: number, now: Date): Promise<number[]> {
    const start = Math.floor(now.getTime() / HOUR) * HOUR - (hours - 1) * HOUR;
    const buckets = await this.reports
      .aggregate<{ _id: number; count: number }>([
        { $match: { createdAt: { $gte: new Date(start) } } },
        {
          $group: {
            _id: { $floor: { $divide: [{ $subtract: [{ $toLong: "$createdAt" }, start] }, HOUR] } },
            count: { $sum: 1 },
          },
        },
      ])
      .toArray();
    const series = Array.from({ length: hours }, () => 0);
    for (const bucket of buckets)
      if (bucket._id >= 0 && bucket._id < hours) series[bucket._id] = bucket.count;
    return series;
  }

  async openReportsByTier(): Promise<Record<PriorityTier, number>> {
    const counts = await this.reports
      .aggregate<{ _id: PriorityTier; count: number }>([
        { $match: { status: "pending-review" } },
        { $group: { _id: "$tier", count: { $sum: 1 } } },
      ])
      .toArray();
    const result: Record<PriorityTier, number> = { critical: 0, high: 0, normal: 0, low: 0 };
    for (const { _id, count } of counts) result[_id] = count;
    return result;
  }

  pendingAppeals(): Promise<number> {
    return this.bans.countDocuments({ "appeal.status": "pending" });
  }

  private async page<TDocument extends Document, TItem>(
    collection: Collection<TDocument>,
    filter: Filter<TDocument>,
    sort: Document,
    page: PageRequest,
    map: (document: TDocument) => TItem,
  ): Promise<PagedResult<TItem>> {
    const [documents, total] = await Promise.all([
      collection.find(filter).sort(sort).skip(page.skip).limit(page.pageSize).toArray(),
      collection.countDocuments(filter),
    ]);
    return toPagedResult(
      documents.map((document) => map(document as TDocument)),
      page,
      total,
    );
  }
}
