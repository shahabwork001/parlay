import { z } from "zod";
import { type HttpClient, httpClient } from "@/lib/http";
import type { ReportCategory } from "@/lib/report-categories";

export const BAN_REASONS = [
  "pending-review",
  "nudity",
  "sexual-content",
  "harassment",
  "hate",
  "violence",
  "spam",
  "scam",
  "minor-safety",
  "underage",
  "repeated-flags",
  "repeated-reports",
  "other",
] as const;

const banSchema = z.object({
  id: z.string(),
  reason: z.enum(BAN_REASONS),
  message: z.string().nullable(),
  startedAt: z.iso.datetime(),
  expiresAt: z.iso.datetime().nullable(),
  appealable: z.boolean(),
  appeal: z
    .object({ status: z.enum(["pending", "accepted", "rejected"]), submittedAt: z.iso.datetime() })
    .nullable(),
});

export type Ban = z.infer<typeof banSchema>;
export type BanReason = Ban["reason"];

const banStatusSchema = z.object({ ban: banSchema.nullable() });
const reportCreatedSchema = z.object({ id: z.string() });

export interface ReportRequest {
  readonly sessionId: string;
  readonly category: ReportCategory;
  readonly note?: string;
  /** JPEG data URL of the partner's video, if any. */
  readonly snapshot?: string;
}

/** Reports about chat partners, and the caller's own ban notice and appeal. */
export class ModerationRepository {
  constructor(private readonly client: HttpClient) {}

  submitReport(report: ReportRequest): Promise<{ id: string }> {
    return this.client.request("/api/v1/reports", {
      method: "POST",
      body: report,
      schema: reportCreatedSchema,
    });
  }

  async getMyBan(signal?: AbortSignal): Promise<Ban | null> {
    return (await this.client.request("/api/v1/me/ban", { schema: banStatusSchema, signal })).ban;
  }

  async appeal(message: string): Promise<Ban> {
    const response = await this.client.request("/api/v1/me/ban/appeal", {
      method: "POST",
      body: { message },
      schema: z.object({ ban: banSchema }),
    });
    return response.ban;
  }
}

export const moderationRepository = new ModerationRepository(httpClient);
