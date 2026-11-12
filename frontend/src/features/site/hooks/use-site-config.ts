"use client";

import { useQuery } from "@tanstack/react-query";
import {
  DEFAULT_SITE_CONFIG,
  type SiteConfig,
  siteRepository,
} from "@/repositories/site-repository";

export const siteConfigQueryKey = ["site", "config"] as const;

export const DEFAULT_MAINTENANCE_MESSAGE =
  "Parley is down for maintenance. Please check back soon.";

/**
 * Site configuration for the UI, refreshed every minute. Until it loads (or if it cannot) the
 * defaults apply; the API enforces the real values either way.
 */
export function useSiteConfig(): SiteConfig {
  const query = useQuery({
    queryKey: siteConfigQueryKey,
    queryFn: ({ signal }) => siteRepository.current(signal),
    staleTime: 15_000,
    refetchInterval: 60_000,
  });
  return query.data ?? DEFAULT_SITE_CONFIG;
}

export function maintenanceMessage(config: SiteConfig): string {
  return config.maintenance.message ?? DEFAULT_MAINTENANCE_MESSAGE;
}
