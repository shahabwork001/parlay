import { Router } from "express";
import type { OpenAPIRegistry } from "@asteasolutions/zod-to-openapi";
import type { AgeAssurance } from "../../../application/features/identity/age-assurance.js";
import { currentPrincipal, requireAuthentication } from "../../auth/authentication.js";
import { sendProblem } from "../../http/problem-details.js";
export function createAgeRouter(age: AgeAssurance): Router {
  const router = Router();
  router.use("/age-verification", requireAuthentication, (req, res, next) => {
    res.set("Cache-Control", "no-store, private");
    if (currentPrincipal(res).kind !== "user") {
      sendProblem(req, res, { status: 403, detail: "An account is required for age verification." });
      return;
    }
    next();
  });
  router.get("/age-verification", async (_req, res) => {
    res.json(await age.status(currentPrincipal(res).subjectId));
  });
  router.post("/age-verification/start", async (req, res) => {
    if (!age.provider.available) {
      sendProblem(req, res, {
        status: 503,
        errorCode: "age.unavailable",
        detail:
          "Age verification is unavailable until an approved provider is configured. Adult Chat remains disabled.",
      });
      return;
    }
    res.json(await age.start(currentPrincipal(res).subjectId));
  });
  return router;
}
export function registerAgeOpenApi(registry: OpenAPIRegistry): void {
  registry.registerPath({
    method: "get",
    path: "/api/v1/age-verification",
    tags: ["Identity"],
    summary: "Current age-assurance status (requires account)",
    responses: { 200: { description: "Verification status; self-attestation is never verified age" } },
  });
}
