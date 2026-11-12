import { z } from "zod";
import { httpClient } from "@/lib/http";
export const ageRepository = {
  status: () =>
    httpClient.request("/api/v1/age-verification", {
      schema: z.object({
        configured: z.boolean(),
        status: z.enum(["not_started", "pending", "verified", "rejected", "expired", "revoked"]),
        expiresAt: z.string().nullable(),
      }),
    }),
  start: () =>
    httpClient.request("/api/v1/age-verification/start", {
      method: "POST",
      schema: z.object({ url: z.httpUrl() }),
    }),
};
