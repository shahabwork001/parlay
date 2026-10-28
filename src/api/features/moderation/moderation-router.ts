import type { OpenAPIRegistry, RouteConfig } from "@asteasolutions/zod-to-openapi";
import { type Request, type Response, Router } from "express";
import { z } from "zod";
import type { RateLimiter } from "../../../application/abstractions/rate-limiter.js";
import type { KeyedHasher } from "../../../application/features/identity/ports.js";
import { type BanView, GetMyBan, SubmitAppeal } from "../../../application/features/moderation/bans.js";
import { GetReportEvidence } from "../../../application/features/moderation/evidence-access.js";
import { type AccessIdentity, networkHashes } from "../../../application/features/moderation/network.js";
import type { SubmitReport } from "../../../application/features/moderation/reports.js";
import {
  type AppealRequest,
  appealSchema,
  decodeSnapshot,
  type SubmitReportRequest,
  submitReportSchema,
} from "../../../application/features/moderation/schemas.js";
import { BAN_REASONS } from "../../../domain/moderation/ban.js";
import type { ModerationContext } from "../../../infrastructure/moderation/moderation-composition.js";
import { currentPrincipal, requireAuthentication, requirePermission } from "../../auth/authentication.js";
import { sendAppError } from "../../http/problem-details.js";
import { rateLimit } from "../../middleware/rate-limit.js";
import { validate, validatedInput } from "../../middleware/validate.js";
import { problemDetailsSchema } from "../../openapi/common-schemas.js";

export interface ModerationRouterDependencies {
  readonly moderation: ModerationContext;
  readonly submitReport: SubmitReport;
  readonly hasher: KeyedHasher;
  readonly rateLimiter: RateLimiter;
  readonly rateLimitMultiplier: number;
}

const HOUR = 60 * 60_000;

const banViewSchema = z
  .object({
    id: z.string(),
    reason: z.enum(BAN_REASONS),
    message: z.string().nullable(),
    startedAt: z.iso.datetime(),
    expiresAt: z.iso.datetime().nullable(),
    appealable: z.boolean(),
    appeal: z
      .object({ status: z.enum(["pending", "accepted", "rejected"]), submittedAt: z.iso.datetime() })
      .nullable(),
  })
  .meta({ id: "Ban" });

const banStatusSchema = z.object({ ban: banViewSchema.nullable() }).meta({ id: "BanStatus" });

const evidenceSchema = z
  .object({
    reportId: z.string(),
    snapshot: z.string().nullable().describe("JPEG data URL"),
    messages: z.array(
      z.object({ from: z.enum(["reporter", "reported"]), text: z.string(), sentAt: z.iso.datetime() }),
    ),
    expiresAt: z.iso.datetime(),
  })
  .meta({ id: "ReportEvidence" });

const toBanResponse = (ban: BanView) => ({
  ...ban,
  startedAt: ban.startedAt.toISOString(),
  expiresAt: ban.expiresAt?.toISOString() ?? null,
  appeal: ban.appeal
    ? { status: ban.appeal.status, submittedAt: ban.appeal.submittedAt.toISOString() }
    : null,
});

/** Reporting, the ban notice and appeals for everyone; report evidence for staff. */
export function createModerationRouter(deps: ModerationRouterDependencies): Router {
  const router = Router();
  const { moderation } = deps;
  const clock = () => new Date();
  const getMyBan = new GetMyBan(moderation.banRepository, clock);
  const submitAppeal = new SubmitAppeal(moderation.banRepository, clock);
  const getEvidence = new GetReportEvidence(moderation.reports, moderation.evidence, moderation.audit, clock);
  const limit = (name: string, maxRequests: number, windowMs: number) =>
    rateLimit(
      { limiter: deps.rateLimiter, hasher: deps.hasher },
      { name, limit: maxRequests * deps.rateLimitMultiplier, windowMs },
    );

  const identityOf = (request: Request, response: Response): AccessIdentity => {
    const principal = currentPrincipal(response);
    return {
      kind: principal.kind,
      subjectId: principal.subjectId,
      deviceId: principal.deviceId,
      ...networkHashes(request.ip ?? "unknown", deps.hasher),
    };
  };

  router.post(
    "/reports",
    requireAuthentication,
    limit("moderation.report", 30, HOUR),
    validate({ body: submitReportSchema }),
    async (request, response) => {
      const body = validatedInput<SubmitReportRequest>(response).body;
      const result = await deps.submitReport.execute({
        reporter: identityOf(request, response),
        sessionId: body.sessionId,
        category: body.category,
        note: body.note || null,
        snapshot: body.snapshot ? decodeSnapshot(body.snapshot) : null,
      });
      if (!result.ok) {
        sendAppError(request, response, result.error);
        return;
      }
      response.status(201).json({ id: result.value.reportId });
    },
  );

  router.get("/me/ban", requireAuthentication, async (request, response) => {
    const ban = await getMyBan.execute(identityOf(request, response));
    response.set("Cache-Control", "no-store").json({ ban: ban ? toBanResponse(ban) : null });
  });

  router.post(
    "/me/ban/appeal",
    requireAuthentication,
    limit("moderation.appeal", 5, HOUR),
    validate({ body: appealSchema }),
    async (request, response) => {
      const result = await submitAppeal.execute(
        identityOf(request, response),
        validatedInput<AppealRequest>(response).body.message,
      );
      if (!result.ok) {
        sendAppError(request, response, result.error);
        return;
      }
      response.status(201).json({ ban: toBanResponse(result.value) });
    },
  );

  router.get(
    "/moderation/reports/:reportId/evidence",
    ...requirePermission("reports.review"),
    validate({ params: z.object({ reportId: z.uuid() }) }),
    async (request, response) => {
      const { reportId } = validatedInput<undefined, undefined, { reportId: string }>(response).params;
      const result = await getEvidence.execute(currentPrincipal(response), reportId);
      if (!result.ok) {
        sendAppError(request, response, result.error);
        return;
      }
      const evidence = result.value;
      response.set("Cache-Control", "no-store, private").json({
        ...evidence,
        messages: evidence.messages.map((message) => ({ ...message, sentAt: message.sentAt.toISOString() })),
        expiresAt: evidence.expiresAt.toISOString(),
      });
    },
  );

  return router;
}

const json = (schema: z.ZodType) => ({ content: { "application/json": { schema } } });
const problem = (description: string) => ({
  description,
  content: { "application/problem+json": { schema: problemDetailsSchema } },
});
const bearer = [{ bearerAuth: [] }];

type Path = Omit<RouteConfig, "method" | "path" | "tags">;

const routes: [RouteConfig["method"], string, string, Path][] = [
  [
    "post",
    "/api/v1/reports",
    "Moderation",
    {
      summary: "Report the partner of a live or recently ended chat",
      description:
        "Ends the chat, blocks the partner for the reporter and stores the snapshot plus the last messages as evidence. Allowed up to 10 minutes after the chat ends.",
      security: bearer,
      request: { body: json(submitReportSchema) },
      responses: {
        201: { description: "Report stored", ...json(z.object({ id: z.string() })) },
        400: problem("Invalid request or snapshot"),
        401: problem("Not signed in"),
        404: problem("Chat not found or report window passed"),
        409: problem("Already reported"),
        429: problem("Too many reports"),
      },
    },
  ],
  [
    "get",
    "/api/v1/me/ban",
    "Moderation",
    {
      summary: "The active ban on this account, device or network, if any",
      security: bearer,
      responses: {
        200: { description: "Ban status", ...json(banStatusSchema) },
        401: problem("Not signed in"),
      },
    },
  ],
  [
    "post",
    "/api/v1/me/ban/appeal",
    "Moderation",
    {
      summary: "Appeal the active ban (once per ban)",
      security: bearer,
      request: { body: json(appealSchema) },
      responses: {
        201: { description: "Appeal submitted", ...json(z.object({ ban: banViewSchema })) },
        400: problem("Validation failed"),
        404: problem("No active ban"),
        409: problem("Already appealed or not appealable"),
      },
    },
  ],
  [
    "get",
    "/api/v1/moderation/reports/{reportId}/evidence",
    "Staff",
    {
      summary: "Report evidence (audited; minor-safety evidence needs moderation.escalate)",
      security: bearer,
      request: { params: z.object({ reportId: z.uuid() }) },
      responses: {
        200: { description: "Evidence", ...json(evidenceSchema) },
        403: problem("Missing permission or two-factor session"),
        404: problem("Report not found or evidence expired"),
      },
    },
  ],
];

export function registerModerationOpenApi(registry: OpenAPIRegistry): void {
  for (const [method, path, tag, config] of routes)
    registry.registerPath({ method, path, tags: [tag], ...config });
}
