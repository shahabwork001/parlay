/**
 * Operator controls for the whole site, edited in the admin panel. Defaults keep everything on.
 * Monetisation flags are deliberately absent: Parley launches free (ADR 0015).
 */
export const FEATURE_FLAGS = ["textChat", "videoChat", "registration"] as const;
export type FeatureFlag = (typeof FEATURE_FLAGS)[number];

export type AnnouncementTone = "info" | "warning";

export interface SiteConfig {
  /** While enabled, nobody but staff can start chats; the message is shown everywhere. */
  readonly maintenance: { readonly enabled: boolean; readonly message: string | null };
  /** A banner on every page, or null for none. */
  readonly announcement: { readonly message: string; readonly tone: AnnouncementTone } | null;
  readonly features: Readonly<Record<FeatureFlag, boolean>>;
  readonly updatedAt: Date | null;
  readonly updatedBy: string | null;
}

export const DEFAULT_SITE_CONFIG: SiteConfig = {
  maintenance: { enabled: false, message: null },
  announcement: null,
  features: { textChat: true, videoChat: true, registration: true },
  updatedAt: null,
  updatedBy: null,
};

export const DEFAULT_MAINTENANCE_MESSAGE = "Parley is down for maintenance. Please check back soon.";

export const isChatModeEnabled = (config: SiteConfig, mode: "text" | "video"): boolean =>
  !config.maintenance.enabled && (mode === "text" ? config.features.textChat : config.features.videoChat);
