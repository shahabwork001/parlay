import { z } from "zod";

const publicConfigSchema = z.object({
  apiBaseUrl: z.url(),
  appName: z.string().min(1),
});

export type PublicConfig = z.infer<typeof publicConfigSchema>;

export const publicConfig: PublicConfig = publicConfigSchema.parse({
  apiBaseUrl: process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8080",
  appName: "Parley",
});
