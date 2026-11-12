import { Router, type Request, type Response, type NextFunction } from "express";
import type { OpenAPIRegistry } from "@asteasolutions/zod-to-openapi";
import { z } from "zod";
import type { BillingService } from "../../../application/features/billing/billing-service.js";
import { BillingError, presetSchema } from "../../../application/features/billing/contracts.js";
import type { Subscription, Payment } from "../../../domain/billing/membership.js";
import type { AuditLog } from "../../../application/features/moderation/ports.js";
import type { RateLimiter } from "../../../application/abstractions/rate-limiter.js";
import { currentPrincipal, requireAuthentication, requirePermission } from "../../auth/authentication.js";
import { sendProblem } from "../../http/problem-details.js";

const publicSubscription = (s: Subscription) => ({
  id: s.id,
  planId: s.planId,
  status: s.status,
  amountMinor: s.amountMinor,
  currency: s.currency,
  currentPeriodEnd: s.currentPeriodEnd,
  cancelAtPeriodEnd: s.cancelAtPeriodEnd,
  cancelRequestedAt: s.cancelRequestedAt,
  presets: s.presets,
});
const publicPayment = (p: Payment) => ({
  id: p.id,
  userId: p.userId,
  subscriptionId: p.subscriptionId,
  amountMinor: p.amountMinor,
  refundedMinor: p.refundedMinor,
  currency: p.currency,
  status: p.status,
  occurredAt: p.occurredAt,
});
export function createBillingRouter(service: BillingService, audit: AuditLog, limiter: RateLimiter): Router {
  const router = Router();
  router.use(["/billing", "/admin/billing"], (_req, res, next) => {
    res.set("Cache-Control", "no-store, private");
    next();
  });
  router.get("/billing/plans", async (_req, res) => {
    const plan = await service.store.plan();
    res.json({
      plan: {
        id: plan.id,
        name: plan.name,
        amountMinor: plan.amountMinor,
        currency: plan.currency,
        interval: plan.interval,
        entitlements: plan.entitlements,
      },
      checkoutEnabled: service.checkoutEnabled,
      mock: service.provider.id === "mock",
    });
  });
  router.post("/billing/webhooks", async (req, res) => {
    if (!Buffer.isBuffer(req.body))
      throw new BillingError(400, "billing.raw_required", "Expected application/json webhook bytes.");
    await service.webhook(req.body, { "x-parley-signature": req.get("x-parley-signature") });
    res.sendStatus(204);
  });
  router.use("/billing/me", requireAuthentication, (req, res, next) => {
    const p = currentPrincipal(res);
    if (p.kind !== "user" || !p.emailVerified) {
      sendProblem(req, res, {
        status: 403,
        errorCode: "billing.account_required",
        detail: "Sign in with a verified email account to manage membership.",
      });
      return;
    }
    next();
  });
  router.get("/billing/me", async (_req, res) => {
    const overview = await service.overview(currentPrincipal(res).subjectId);
    res.json({
      ...overview,
      subscription: overview.subscription ? publicSubscription(overview.subscription) : null,
    });
  });
  router.post("/billing/me/checkout", async (req, res) => {
    const id = currentPrincipal(res).subjectId;
    const key = z.uuid().safeParse(req.get("idempotency-key"));
    if (!key.success)
      throw new BillingError(400, "billing.request_key", "A UUID Idempotency-Key is required.");
    if (!(await limiter.consume(`billing.checkout:${id}`, 10, 60_000)).allowed)
      throw new BillingError(429, "billing.rate_limited", "Try again shortly.");
    res.json(await service.checkout(id, key.data));
  });
  router.post("/billing/me/:id/cancel", async (req, res) => {
    await service.cancel(currentPrincipal(res).subjectId, z.uuid().parse(req.params.id));
    res.sendStatus(204);
  });
  router.put("/billing/me/presets", async (req, res) => {
    await service.savePresets(
      currentPrincipal(res).subjectId,
      z
        .object({ presets: z.array(presetSchema).max(5) })
        .strict()
        .parse(req.body).presets,
    );
    res.sendStatus(204);
  });
  router.get("/admin/billing", ...requirePermission("plans.manage"), async (req, res) => {
    const offset = z.coerce.number().int().min(0).max(100_000).default(0).parse(req.query.offset);
    res.json({
      subscriptions: (await service.store.listSubscriptions(offset)).map((s) => ({
        ...publicSubscription(s),
        userId: s.userId,
        provider: s.provider,
      })),
      payments: (await service.store.listPayments(offset)).map(publicPayment),
      offset,
      pageSize: 50,
    });
  });
  router.put("/admin/billing/plan", ...requirePermission("plans.manage"), async (req, res) => {
    const amount = z
      .object({ amountMinor: z.number().int().min(100).max(100_000) })
      .strict()
      .parse(req.body).amountMinor;
    const principal = currentPrincipal(res);
    await audit.record({
      actor: { kind: "staff", subjectId: principal.subjectId, roles: principal.roles },
      action: "billing.plan_updated",
      target: { type: "plan", id: "parley-plus" },
      metadata: { amountMinor: amount },
      at: new Date(),
    });
    const plan = await service.store.savePlan(amount);
    res.json({ amountMinor: plan.amountMinor });
  });
  router.use((error: unknown, req: Request, res: Response, next: NextFunction) => {
    if (error instanceof BillingError) {
      sendProblem(req, res, { status: error.status, errorCode: error.code, detail: error.message });
      return;
    }
    if (error instanceof z.ZodError) {
      sendProblem(req, res, {
        status: 400,
        errorCode: "billing.validation",
        detail: "Invalid billing input.",
      });
      return;
    }
    next(error);
  });
  return router;
}
export function registerBillingOpenApi(registry: OpenAPIRegistry): void {
  for (const path of ["/billing/plans", "/billing/me", "/admin/billing"])
    registry.registerPath({
      method: "get",
      path: `/api/v1${path}`,
      tags: ["Billing"],
      summary: "Membership pricing or authenticated billing records",
      responses: { 200: { description: "Billing data" } },
    });
}
