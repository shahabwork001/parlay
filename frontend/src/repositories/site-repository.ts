import { z } from "zod";
import { type HttpClient, httpClient } from "@/lib/http";

const siteConfigSchema = z.object({
  maintenance: z.object({ enabled: z.boolean(), message: z.string().nullable() }),
  announcement: z.object({ message: z.string(), tone: z.enum(["info", "warning"]) }).nullable(),
  features: z.object({ textChat: z.boolean(), videoChat: z.boolean(), registration: z.boolean() }),
});

const adminSiteConfigSchema = siteConfigSchema.extend({
  updatedAt: z.iso.datetime().nullable(),
  updatedBy: z.string().nullable(),
});

export type SiteConfig = z.infer<typeof siteConfigSchema>;
export type AdminSiteConfig = z.infer<typeof adminSiteConfigSchema>;

/** Used while the configuration loads (or if it cannot): everything open, as the API defaults. */
export const DEFAULT_SITE_CONFIG: SiteConfig = {
  maintenance: { enabled: false, message: null },
  announcement: null,
  features: { textChat: true, videoChat: true, registration: true },
};

/** Announcement, maintenance mode and feature flags (public), and their admin editor. */
export class SiteRepository {
  constructor(private readonly client: HttpClient) {}

  current(signal?: AbortSignal): Promise<SiteConfig> {
    return this.client.request("/api/v1/site", { schema: siteConfigSchema, signal });
  }

  adminCurrent(signal?: AbortSignal): Promise<AdminSiteConfig> {
    return this.client.request("/api/v1/admin/site", { schema: adminSiteConfigSchema, signal });
  }

  save(config: SiteConfig): Promise<AdminSiteConfig> {
    return this.client.request("/api/v1/admin/site", {
      method: "PUT",
      body: config,
      schema: adminSiteConfigSchema,
    });
  }
}

export const siteRepository = new SiteRepository(httpClient);
