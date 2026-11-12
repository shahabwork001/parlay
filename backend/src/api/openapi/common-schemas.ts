import { z } from "zod";

export const problemDetailsSchema = z
  .object({
    type: z.string(),
    title: z.string(),
    status: z.number().int(),
    detail: z.string().optional(),
    instance: z.string().optional(),
    traceId: z.string().optional(),
    errorCode: z.string().optional(),
    errors: z.record(z.string(), z.array(z.string())).optional(),
  })
  .meta({ id: "ProblemDetails" });
