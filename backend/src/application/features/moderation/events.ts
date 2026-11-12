import { z } from "zod";
import { BAN_REASONS } from "../../../domain/moderation/ban.js";
import { defineIntegrationEvent } from "../../abstractions/messaging/integration-event.js";
import { CHAT_MODES } from "../chat/chat-types.js";

/** A report was stored; the moderation worker scores and prioritises it. */
export const ReportSubmitted = defineIntegrationEvent(
  "moderation.report-submitted.v1",
  z.object({ reportId: z.string().min(1) }),
);

const identitySchema = z.object({
  subjectId: z.string().min(1),
  deviceId: z.string().min(1),
  kind: z.enum(["user", "anonymous"]),
});

/** Someone's own content was flagged: client-side video screening or a rejected message. */
export const ContentFlagged = defineIntegrationEvent(
  "moderation.content-flagged.v1",
  identitySchema.extend({
    source: z.enum(["nsfw-screening", "blocked-message"]),
    score: z.number().min(0).max(1).nullable(),
    flaggedAt: z.iso.datetime(),
  }),
);

export type ContentFlaggedPayload = z.infer<typeof ContentFlagged.schema>;

export const BanIssued = defineIntegrationEvent(
  "moderation.ban-issued.v1",
  z.object({
    banId: z.string().min(1),
    mode: z.enum(["full", "shadow"]),
    reason: z.enum(BAN_REASONS),
    source: z.enum(["moderator", "automatic"]),
    createdBy: z.string().nullable(),
    reportId: z.string().nullable(),
    targetKinds: z.array(z.string()),
    expiresAt: z.iso.datetime().nullable(),
    issuedAt: z.iso.datetime(),
  }),
);

export type BanIssuedPayload = z.infer<typeof BanIssued.schema>;

/** A chat ended (any reason). Clean sessions slowly raise trust. */
export const SessionEnded = defineIntegrationEvent(
  "chat.session-ended.v1",
  z.object({
    sessionId: z.string().min(1),
    mode: z.enum(CHAT_MODES),
    startedAt: z.iso.datetime(),
    endedAt: z.iso.datetime(),
    participants: z.array(identitySchema).length(2),
  }),
);

export type SessionEndedPayload = z.infer<typeof SessionEnded.schema>;
