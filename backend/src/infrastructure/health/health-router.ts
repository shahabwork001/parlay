import { Router } from "express";
import type { Logger } from "../observability/logger.js";
import { type HealthCheck, type HealthReport, runHealthChecks } from "./health-check.js";

const toPublicPayload = (report: HealthReport) => ({
  status: report.status,
  checks: report.entries.map((entry) => ({ name: entry.name, status: entry.status })),
});

/**
 * `GET /health/live`: the process is up (no dependency checks).
 * `GET /health/ready`: every dependency is reachable; 503 otherwise.
 * Payloads expose component names and statuses only, never error details.
 */
export function createHealthRouter(checks: readonly HealthCheck[], logger: Logger): Router {
  const router = Router();

  router.get("/health/live", (_request, response) => {
    response.set("Cache-Control", "no-store").json({ status: "Healthy", checks: [] });
  });

  router.get("/health/ready", async (_request, response) => {
    const report = await runHealthChecks(checks);
    for (const entry of report.entries.filter((item) => item.status !== "Healthy")) {
      logger.warn(
        { check: entry.name, status: entry.status, description: entry.description },
        "Health check failed",
      );
    }
    response
      .status(report.status === "Unhealthy" ? 503 : 200)
      .set("Cache-Control", "no-store")
      .json(toPublicPayload(report));
  });

  return router;
}
