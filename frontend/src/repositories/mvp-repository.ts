import { z } from "zod";
import { httpClient } from "@/lib/http";
export const mvpRepository = {
  activity: () =>
    httpClient.request("/api/v1/product/activity", { method: "POST", schema: z.undefined() }),
  preview: () =>
    httpClient.request("/api/v1/premium/preview", { method: "POST", schema: z.undefined() }),
  waitlist: () =>
    httpClient.request("/api/v1/premium/waitlist", { schema: z.object({ joined: z.boolean() }) }),
  join: () =>
    httpClient.request("/api/v1/premium/waitlist", {
      method: "POST",
      body: { consent: true },
      schema: z.object({ joined: z.boolean() }),
    }),
  leave: () =>
    httpClient.request("/api/v1/premium/waitlist", { method: "DELETE", schema: z.undefined() }),
  metrics: () =>
    httpClient.request("/api/v1/admin/product-metrics", {
      schema: z.object({
        day: z.string(),
        registeredUsers: z.number(),
        activeToday: z.number(),
        repeatVisitors: z.number(),
        matchAttempts: z.number(),
        successfulMatches: z.number(),
        averageWaitMs: z.number().nullable(),
        sampledP95WaitMs: z.number().nullable(),
        averageSessionMs: z.number().nullable(),
        endedSessions: z.number(),
        rtcFailureRate: z.number().nullable(),
        rtcReports: z.number(),
        waitlistSignups: z.number(),
        premiumPreviewVisitors: z.number(),
        waitlistConversion: z.number().nullable(),
      }),
    }),
};
