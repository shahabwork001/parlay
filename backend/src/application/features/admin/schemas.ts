import { z } from "zod";
import { ROLES } from "../../../domain/identity/roles.js";
import { BAN_REASONS } from "../../../domain/moderation/ban.js";
import { DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE } from "../../common/paging.js";

const page = {
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(MAX_PAGE_SIZE).default(DEFAULT_PAGE_SIZE),
};

const note = z.string().trim().max(1000).optional();
const userMessage = z.string().trim().max(500).optional();
/** Up to a year; null means permanent. */
const durationHours = z
  .number()
  .int()
  .min(1)
  .max(24 * 365)
  .nullable();

export const reportListQuerySchema = z.object({
  status: z.enum(["open", "resolved", "all"]).default("open"),
  sort: z.enum(["priority", "newest", "oldest"]).optional(),
  tier: z.enum(["critical", "high", "normal", "low"]).optional(),
  reportedSubjectId: z.string().min(1).max(64).optional(),
  ...page,
});

export const reportDecisionSchema = z
  .discriminatedUnion("action", [
    z.object({ action: z.literal("dismiss"), note }),
    z.object({ action: z.literal("warn"), note, message: userMessage }),
    z.object({
      action: z.literal("ban"),
      mode: z.enum(["full", "shadow"]),
      durationHours,
      includeNetwork: z.boolean().default(false),
      message: userMessage,
      note,
    }),
  ])
  .meta({ id: "ReportDecision" });

export const escalationSchema = z
  .object({
    status: z.enum(["reported", "not-required"]),
    reference: z.string().trim().max(100).optional(),
  })
  .meta({ id: "EscalationRecord" });

export const banListQuerySchema = z.object({
  filter: z.enum(["active", "appeals", "all"]).default("active"),
  target: z.string().min(1).max(64).optional(),
  ...page,
});

export const manualBanSchema = z
  .object({
    accountId: z.string().min(1).max(64).optional(),
    deviceIds: z.array(z.string().min(1).max(64)).max(20).optional(),
    ip: z.union([z.ipv4(), z.ipv6()]).optional(),
    includeSubnet: z.boolean().default(false),
    mode: z.enum(["full", "shadow"]),
    reason: z.enum(BAN_REASONS).refine((reason) => reason !== "pending-review", {
      message: "Pending review is reserved for automatic suspensions.",
    }),
    durationHours,
    message: userMessage,
  })
  .meta({ id: "ManualBan" });

export const appealDecisionSchema = z.object({ accept: z.boolean() }).meta({ id: "AppealDecision" });

export const userSearchQuerySchema = z.object({
  q: z.string().trim().max(254).default(""),
  sort: z.enum(["newest", "oldest", "email"]).default("newest"),
  ...page,
});

export const staffRolesSchema = z
  .object({
    userId: z.string().min(1).max(64).optional(),
    email: z.email().optional(),
    roles: z.array(z.enum(ROLES)).max(ROLES.length),
  })
  .refine((value) => Boolean(value.userId ?? value.email), { message: "Give an email or a user id." })
  .meta({ id: "StaffRoles" });

const wordList = z.array(z.string().trim().min(1).max(40)).max(2000);

export const textRulesSchema = z
  .object({
    maskedWords: wordList,
    blockedWords: wordList,
    removeLinks: z.boolean(),
    removePhoneNumbers: z.boolean(),
    removeSocialHandles: z.boolean(),
    maxRepeats: z.number().int().min(2).max(20),
    repeatWindowSeconds: z.number().int().min(5).max(600),
  })
  .meta({ id: "TextRules" });

export const auditQuerySchema = z.object({
  action: z.string().trim().max(64).optional(),
  actorId: z.string().trim().max(64).optional(),
  targetId: z.string().trim().max(64).optional(),
  order: z.enum(["newest", "oldest"]).default("newest"),
  ...page,
});

export const idParamSchema = z.object({ id: z.string().min(1).max(64) });

export type ReportListQueryInput = z.infer<typeof reportListQuerySchema>;
export type ReportDecisionInput = z.infer<typeof reportDecisionSchema>;
export type EscalationInput = z.infer<typeof escalationSchema>;
export type BanListQueryInput = z.infer<typeof banListQuerySchema>;
export type ManualBanInput = z.infer<typeof manualBanSchema>;
export type UserSearchQueryInput = z.infer<typeof userSearchQuerySchema>;
export type StaffRolesInput = z.infer<typeof staffRolesSchema>;
export type TextRulesInput = z.infer<typeof textRulesSchema>;
export type AuditQueryInput = z.infer<typeof auditQuerySchema>;
