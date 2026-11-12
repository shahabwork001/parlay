import { z } from "zod";
import { type HttpClient, httpClient } from "@/lib/http";
import { REPORT_CATEGORIES } from "@/lib/report-categories";
import { ROLES } from "@/lib/schemas/auth";
import { BAN_REASONS } from "./moderation-repository";

/*
 * Staff API (/api/v1/admin). Response schemas validate what the admin UI reads; the API authorises
 * every call again, so nothing here is a security boundary.
 */

const date = z.iso.datetime();
const tier = z.enum(["critical", "high", "normal", "low"]);
const category = z.enum(REPORT_CATEGORIES.map((option) => option.value) as [string, ...string[]]);
const outcome = z.enum(["dismissed", "warned", "banned"]);
const escalation = z.enum(["required", "reported", "not-required"]).nullable();

const paged = <T extends z.ZodType>(item: T) =>
  z.object({
    items: z.array(item),
    page: z.number(),
    pageSize: z.number(),
    totalCount: z.number(),
    totalPages: z.number(),
    hasNextPage: z.boolean(),
  });

export type Paged<T> = {
  items: T[];
  page: number;
  totalPages: number;
  totalCount: number;
  hasNextPage: boolean;
};

const reportSummarySchema = z.object({
  id: z.string(),
  category,
  notePreview: z.string().nullable(),
  mode: z.enum(["text", "video"]),
  tier,
  priority: z.number(),
  status: z.enum(["pending-review", "dismissed", "actioned"]),
  outcome: outcome.nullable(),
  escalation,
  hasEvidence: z.boolean(),
  labels: z.array(z.string()),
  reportedKind: z.enum(["user", "anonymous"]),
  createdAt: date,
});

const party = z.object({
  subjectId: z.string(),
  deviceId: z.string(),
  kind: z.enum(["user", "anonymous"]),
});

const reportSchema = z.object({
  id: z.string(),
  sessionId: z.string(),
  mode: z.enum(["text", "video"]),
  category,
  note: z.string().nullable(),
  reporter: party,
  reported: party,
  hasEvidence: z.boolean(),
  status: z.enum(["pending-review", "dismissed", "actioned"]),
  priority: z.number(),
  tier,
  score: z
    .object({
      image: z.number().nullable(),
      text: z.number().nullable(),
      labels: z.array(z.string()),
    })
    .nullable(),
  escalation,
  escalationReference: z.string().nullable(),
  resolution: z
    .object({ outcome, by: z.string(), at: date, note: z.string().nullable() })
    .nullable(),
  createdAt: date,
  scoredAt: date.nullable(),
  resolvedAt: date.nullable(),
});

const banSchema = z.object({
  id: z.string(),
  targets: z.array(
    z.object({ kind: z.enum(["account", "device", "ip", "subnet"]), value: z.string() }),
  ),
  mode: z.enum(["full", "shadow"]),
  reason: z.enum(BAN_REASONS),
  message: z.string().nullable(),
  source: z.enum(["moderator", "automatic"]),
  createdBy: z.string().nullable(),
  reportId: z.string().nullable(),
  createdAt: date,
  expiresAt: date.nullable(),
  liftedAt: date.nullable(),
  appeal: z
    .object({
      message: z.string(),
      status: z.enum(["pending", "accepted", "rejected"]),
      submittedAt: date,
    })
    .nullable(),
});

const reportDetailSchema = z.object({
  report: reportSchema,
  reporterTrust: z.number(),
  reportedTrust: z.number(),
  reportedHistory: z.object({ total: z.number(), upheld: z.number(), lastDay: z.number() }),
  reporterHistory: z.object({ total: z.number(), dismissed: z.number() }),
  activeBans: z.array(banSchema),
});

const evidenceSchema = z.object({
  reportId: z.string(),
  snapshot: z.string().nullable(),
  messages: z.array(
    z.object({ from: z.enum(["reporter", "reported"]), text: z.string(), sentAt: date }),
  ),
  expiresAt: date,
});

const userSummarySchema = z.object({
  id: z.string(),
  email: z.string(),
  roles: z.array(z.enum(ROLES)),
  emailVerified: z.boolean(),
  twoFactorEnabled: z.boolean(),
  createdAt: date,
});

const userDetailSchema = z.object({
  user: userSummarySchema.extend({ lockedUntil: date.nullable() }),
  trust: z.number(),
  sessions: z.array(
    z.object({
      familyId: z.string(),
      deviceId: z.string(),
      mfa: z.boolean(),
      startedAt: date,
      lastActiveAt: date,
      active: z.boolean(),
    }),
  ),
  reportsAgainst: z.object({ total: z.number(), upheld: z.number(), lastDay: z.number() }),
  reportsFiled: z.object({ total: z.number(), dismissed: z.number() }),
  bans: paged(banSchema),
});

const dashboardSchema = z.object({
  online: z.number(),
  waiting: z.object({ text: z.number(), video: z.number() }),
  activeSessions: z.number(),
  matchesPerMinute: z.array(z.number()),
  averageWaitMs: z.number().nullable(),
  reportsPerHour: z.array(z.number()),
  openReports: z.record(tier, z.number()),
  pendingAppeals: z.number(),
  generatedAt: date,
});

export const textRulesSchema = z.object({
  maskedWords: z.array(z.string()),
  blockedWords: z.array(z.string()),
  removeLinks: z.boolean(),
  removePhoneNumbers: z.boolean(),
  removeSocialHandles: z.boolean(),
  maxRepeats: z.number().int().min(2).max(20),
  repeatWindowSeconds: z.number().int().min(5).max(600),
});

const auditEntrySchema = z.object({
  id: z.string(),
  actor: z.object({
    kind: z.enum(["staff", "system"]),
    subjectId: z.string().nullable(),
    roles: z.array(z.string()),
  }),
  action: z.string(),
  target: z.object({ type: z.string(), id: z.string() }),
  metadata: z
    .record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.null()]))
    .optional(),
  at: date,
});

const systemSchema = z.object({
  health: z.object({
    status: z.enum(["Healthy", "Degraded", "Unhealthy"]),
    entries: z.array(
      z.object({
        name: z.string(),
        status: z.enum(["Healthy", "Degraded", "Unhealthy"]),
        description: z.string().optional(),
      }),
    ),
  }),
  queues: z.array(z.object({ queue: z.string(), messages: z.number(), consumers: z.number() })),
  checkedAt: date,
});

export type ReportSummary = z.infer<typeof reportSummarySchema>;
export type AdminReport = z.infer<typeof reportSchema>;
export type ReportDetail = z.infer<typeof reportDetailSchema>;
export type Evidence = z.infer<typeof evidenceSchema>;
export type AdminBan = z.infer<typeof banSchema>;
export type UserSummary = z.infer<typeof userSummarySchema>;
export type UserDetail = z.infer<typeof userDetailSchema>;
export type Dashboard = z.infer<typeof dashboardSchema>;
export type TextRules = z.infer<typeof textRulesSchema>;
export type AuditEntry = z.infer<typeof auditEntrySchema>;
export type SystemStatus = z.infer<typeof systemSchema>;
export type Tier = z.infer<typeof tier>;

export type ReportDecision =
  | { action: "dismiss"; note?: string }
  | { action: "warn"; note?: string; message?: string }
  | {
      action: "ban";
      mode: "full" | "shadow";
      durationHours: number | null;
      includeNetwork: boolean;
      message?: string;
      note?: string;
    };

export interface ManualBanRequest {
  accountId?: string;
  deviceIds?: string[];
  ip?: string;
  includeSubnet: boolean;
  mode: "full" | "shadow";
  reason: AdminBan["reason"];
  durationHours: number | null;
  message?: string;
}

const query = (values: Record<string, string | number | undefined>) => {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(values))
    if (value !== undefined && value !== "") params.set(key, String(value));
  const text = params.toString();
  return text ? `?${text}` : "";
};

export class AdminRepository {
  constructor(private readonly client: HttpClient) {}

  dashboard(signal?: AbortSignal): Promise<Dashboard> {
    return this.client.request("/api/v1/admin/dashboard", { schema: dashboardSchema, signal });
  }

  listReports(
    filter: {
      status: "open" | "resolved" | "all";
      tier?: Tier;
      sort?: "priority" | "newest" | "oldest";
      page: number;
    },
    signal?: AbortSignal,
  ): Promise<Paged<ReportSummary>> {
    return this.client.request(`/api/v1/admin/reports${query({ ...filter, pageSize: 25 })}`, {
      schema: paged(reportSummarySchema),
      signal,
    });
  }

  report(id: string, signal?: AbortSignal): Promise<ReportDetail> {
    return this.client.request(`/api/v1/admin/reports/${encodeURIComponent(id)}`, {
      schema: reportDetailSchema,
      signal,
    });
  }

  evidence(reportId: string, signal?: AbortSignal): Promise<Evidence> {
    return this.client.request(
      `/api/v1/moderation/reports/${encodeURIComponent(reportId)}/evidence`,
      {
        schema: evidenceSchema,
        signal,
      },
    );
  }

  decide(reportId: string, decision: ReportDecision): Promise<AdminReport> {
    return this.client.request(`/api/v1/admin/reports/${encodeURIComponent(reportId)}/decision`, {
      method: "POST",
      body: decision,
      schema: reportSchema,
    });
  }

  recordEscalation(
    reportId: string,
    record: { status: "reported" | "not-required"; reference?: string },
  ): Promise<AdminReport> {
    return this.client.request(`/api/v1/admin/reports/${encodeURIComponent(reportId)}/escalation`, {
      method: "POST",
      body: record,
      schema: reportSchema,
    });
  }

  listBans(
    filter: { filter: "active" | "appeals" | "all"; target?: string; page: number },
    signal?: AbortSignal,
  ): Promise<Paged<AdminBan>> {
    return this.client.request(`/api/v1/admin/bans${query({ ...filter, pageSize: 25 })}`, {
      schema: paged(banSchema),
      signal,
    });
  }

  issueBan(request: ManualBanRequest): Promise<AdminBan> {
    return this.client.request("/api/v1/admin/bans", {
      method: "POST",
      body: request,
      schema: banSchema,
    });
  }

  liftBan(banId: string): Promise<AdminBan> {
    return this.client.request(`/api/v1/admin/bans/${encodeURIComponent(banId)}/lift`, {
      method: "POST",
      schema: banSchema,
    });
  }

  decideAppeal(banId: string, accept: boolean): Promise<AdminBan> {
    return this.client.request(`/api/v1/admin/bans/${encodeURIComponent(banId)}/appeal`, {
      method: "POST",
      body: { accept },
      schema: banSchema,
    });
  }

  searchUsers(
    filter: { q: string; sort: "newest" | "oldest" | "email"; page: number },
    signal?: AbortSignal,
  ): Promise<Paged<UserSummary>> {
    return this.client.request(`/api/v1/admin/users${query({ ...filter, pageSize: 25 })}`, {
      schema: paged(userSummarySchema),
      signal,
    });
  }

  user(id: string, signal?: AbortSignal): Promise<UserDetail> {
    return this.client.request(`/api/v1/admin/users/${encodeURIComponent(id)}`, {
      schema: userDetailSchema,
      signal,
    });
  }

  textRules(signal?: AbortSignal): Promise<TextRules> {
    return this.client.request("/api/v1/admin/rules/text", { schema: textRulesSchema, signal });
  }

  saveTextRules(rules: TextRules): Promise<TextRules> {
    return this.client.request("/api/v1/admin/rules/text", {
      method: "PUT",
      body: rules,
      schema: textRulesSchema,
    });
  }

  async staff(signal?: AbortSignal): Promise<UserSummary[]> {
    return (
      await this.client.request("/api/v1/admin/staff", {
        schema: z.object({ items: z.array(userSummarySchema) }),
        signal,
      })
    ).items;
  }

  setRoles(target: { email?: string; userId?: string }, roles: string[]): Promise<UserSummary> {
    return this.client.request("/api/v1/admin/staff/roles", {
      method: "PUT",
      body: { ...target, roles },
      schema: userSummarySchema.extend({ lockedUntil: date.nullable() }),
    });
  }

  audit(
    filter: {
      action?: string;
      actorId?: string;
      targetId?: string;
      order?: "newest" | "oldest";
      page: number;
    },
    signal?: AbortSignal,
  ): Promise<Paged<AuditEntry>> {
    return this.client.request(`/api/v1/admin/audit${query({ ...filter, pageSize: 50 })}`, {
      schema: paged(auditEntrySchema),
      signal,
    });
  }

  system(signal?: AbortSignal): Promise<SystemStatus> {
    return this.client.request("/api/v1/admin/system", { schema: systemSchema, signal });
  }
}

export const adminRepository = new AdminRepository(httpClient);
