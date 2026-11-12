import { z } from "zod";
import type { Principal } from "../identity/ports.js";
import { FEATURE_FLAGS, type SiteConfig } from "../../../domain/site/site-config.js";
import type { AuditLog } from "../moderation/ports.js";
import { staffActor } from "../admin/admin-context.js";

export interface SiteConfigProvider {
  current(): Promise<SiteConfig>;
}

export interface SiteConfigRepository extends SiteConfigProvider {
  save(config: SiteConfig): Promise<void>;
}

const message = z.string().trim().min(1).max(280);

export const siteConfigSchema = z
  .object({
    maintenance: z.object({ enabled: z.boolean(), message: message.nullable() }),
    announcement: z.object({ message, tone: z.enum(["info", "warning"]) }).nullable(),
    features: z.object(
      Object.fromEntries(FEATURE_FLAGS.map((flag) => [flag, z.boolean()])) as Record<
        (typeof FEATURE_FLAGS)[number],
        z.ZodBoolean
      >,
    ),
  })
  .meta({ id: "SiteConfigUpdate" });

export type SiteConfigInput = z.infer<typeof siteConfigSchema>;

/** What visitors may see: no editor identity. */
export const publicSiteConfig = (config: SiteConfig) => ({
  maintenance: config.maintenance,
  announcement: config.announcement,
  features: config.features,
});

export class UpdateSiteConfig {
  constructor(
    private readonly repository: SiteConfigRepository,
    private readonly audit: AuditLog,
    private readonly clock: () => Date,
  ) {}

  async execute(staff: Principal, input: SiteConfigInput): Promise<SiteConfig> {
    const before = await this.repository.current();
    const now = this.clock();
    const config: SiteConfig = { ...input, updatedAt: now, updatedBy: staff.subjectId };
    await this.repository.save(config);

    const changed = (Object.keys(input.features) as (keyof typeof input.features)[]).filter(
      (flag) => before.features[flag] !== input.features[flag],
    );
    await this.audit.record({
      actor: staffActor(staff),
      action: "site.updated",
      target: { type: "site", id: "config" },
      metadata: {
        maintenance: input.maintenance.enabled,
        announcement: input.announcement !== null,
        changedFlags: changed.join(",") || null,
      },
      at: now,
    });
    return config;
  }
}
