import type { Collection, Db } from "mongodb";
import type { SiteConfigRepository } from "../../application/features/site/site-config.js";
import { DEFAULT_SITE_CONFIG, type SiteConfig } from "../../domain/site/site-config.js";

const COLLECTION = "site_config";
const ID = "site";

type SiteConfigDocument = Omit<SiteConfig, "features"> & {
  _id: string;
  features: Partial<SiteConfig["features"]>;
};

/**
 * One document, cached in process. Saves apply at once on this instance and within `refreshMs`
 * elsewhere. Flags missing from an older document fall back to their defaults.
 */
export class MongoSiteConfig implements SiteConfigRepository {
  readonly #configs: Collection<SiteConfigDocument>;
  #cached: { config: SiteConfig; loadedAt: number } | null = null;

  constructor(
    database: Db,
    private readonly refreshMs = 15_000,
    private readonly now: () => number = Date.now,
  ) {
    this.#configs = database.collection<SiteConfigDocument>(COLLECTION);
  }

  async current(): Promise<SiteConfig> {
    if (this.#cached && this.now() - this.#cached.loadedAt < this.refreshMs) return this.#cached.config;
    const document = await this.#configs.findOne({ _id: ID });
    const config: SiteConfig = document
      ? {
          maintenance: document.maintenance,
          announcement: document.announcement,
          features: { ...DEFAULT_SITE_CONFIG.features, ...document.features },
          updatedAt: document.updatedAt,
          updatedBy: document.updatedBy,
        }
      : DEFAULT_SITE_CONFIG;
    this.#cached = { config, loadedAt: this.now() };
    return config;
  }

  /** Stores the defaults unless a configuration exists (seed). Returns true when it wrote them. */
  async ensureDefaults(): Promise<boolean> {
    const result = await this.#configs.updateOne(
      { _id: ID },
      { $setOnInsert: { ...DEFAULT_SITE_CONFIG } },
      { upsert: true },
    );
    return result.upsertedCount === 1;
  }

  async save(config: SiteConfig): Promise<void> {
    await this.#configs.replaceOne({ _id: ID }, { ...config }, { upsert: true });
    this.#cached = { config, loadedAt: this.now() };
  }
}
