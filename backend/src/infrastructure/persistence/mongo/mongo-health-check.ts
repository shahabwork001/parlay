import type { Db } from "mongodb";
import type { HealthCheck, HealthCheckResult } from "../../health/health-check.js";

export class MongoHealthCheck implements HealthCheck {
  readonly name = "mongodb";

  constructor(private readonly database: Db) {}

  async check(): Promise<HealthCheckResult> {
    await this.database.command({ ping: 1 });
    return { status: "Healthy" };
  }
}
