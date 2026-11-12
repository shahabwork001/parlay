import { z } from "zod";
import { type HttpClient, httpClient } from "@/lib/http";

const healthStatusSchema = z.enum(["Healthy", "Degraded", "Unhealthy"]);

export const healthReportSchema = z.object({
  status: healthStatusSchema,
  checks: z.array(z.object({ name: z.string(), status: healthStatusSchema })),
});

export type HealthStatus = z.infer<typeof healthStatusSchema>;
export type HealthReport = z.infer<typeof healthReportSchema>;

export class SystemRepository {
  constructor(private readonly client: HttpClient) {}

  getReadiness(signal?: AbortSignal): Promise<HealthReport> {
    return this.client.request("/health/ready", {
      schema: healthReportSchema,
      signal,
      acceptedStatuses: [503],
    });
  }
}

export const systemRepository = new SystemRepository(httpClient);
