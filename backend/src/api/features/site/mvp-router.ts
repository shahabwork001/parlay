import { Router } from "express";
import type { OpenAPIRegistry } from "@asteasolutions/zod-to-openapi";
import { z } from "zod";
import type { MvpInsights } from "../../../infrastructure/admin/mvp-insights.js";
import type { RateLimiter } from "../../../application/abstractions/rate-limiter.js";
import { currentPrincipal, requireAuthentication, requirePermission } from "../../auth/authentication.js";
import { sendProblem } from "../../http/problem-details.js";
export function createMvpRouter(insights: MvpInsights, limiter: RateLimiter): Router {
  const router = Router();
  router.use(["/product", "/premium"], requireAuthentication, async (req, res, next) => {
    res.set("Cache-Control", "no-store, private");
    if (!(await limiter.consume(`product:${currentPrincipal(res).subjectId}`, 30, 60_000)).allowed) {
      sendProblem(req, res, { status: 429, detail: "Try again shortly." });
      return;
    }
    next();
  });
  router.post("/product/activity", async (_req, res) => {
    await insights.activity(currentPrincipal(res).subjectId);
    res.sendStatus(204);
  });
  router.post("/premium/preview", async (_req, res) => {
    await insights.preview(currentPrincipal(res).subjectId);
    res.sendStatus(204);
  });
  router.use("/premium/waitlist", (req, res, next) => {
    const principal = currentPrincipal(res);
    if (principal.kind !== "user" || !principal.emailVerified) {
      sendProblem(req, res, {
        status: 403,
        detail: "Sign in with a verified email account to join the waitlist.",
      });
      return;
    }
    next();
  });
  router.get("/premium/waitlist", async (_req, res) => {
    res.json({ joined: await insights.joined(currentPrincipal(res).subjectId) });
  });
  router.post("/premium/waitlist", async (req, res) => {
    if (
      !z
        .object({ consent: z.literal(true) })
        .strict()
        .safeParse(req.body).success
    ) {
      sendProblem(req, res, { status: 400, detail: "Explicit waitlist consent is required." });
      return;
    }
    await insights.join(currentPrincipal(res).subjectId);
    res.json({ joined: true });
  });
  router.delete("/premium/waitlist", async (_req, res) => {
    await insights.leave(currentPrincipal(res).subjectId);
    res.sendStatus(204);
  });
  router.get("/admin/product-metrics", ...requirePermission("dashboard.view"), async (_req, res) => {
    res.set("Cache-Control", "no-store, private").json(await insights.summary());
  });
  return router;
}
export function registerMvpOpenApi(registry: OpenAPIRegistry): void {
  registry.registerPath({
    method: "get",
    path: "/api/v1/admin/product-metrics",
    tags: ["Admin"],
    summary: "First-party MVP activity and opt-in premium demand",
    responses: {
      200: { description: "Aggregate metrics; UTC days, sampled p95 and self-reported RTC outcomes" },
    },
  });
}
