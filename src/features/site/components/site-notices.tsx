"use client";

import { cn } from "@/lib/utils";
import { maintenanceMessage, useSiteConfig } from "../hooks/use-site-config";

/**
 * The site-wide announcement and the maintenance notice, under the header on every page.
 * Announcements are polite live regions; maintenance is shown with more weight.
 */
export function SiteNotices() {
  const config = useSiteConfig();
  const { announcement, maintenance } = config;
  if (!announcement && !maintenance.enabled) return null;

  return (
    <div className="flex flex-col">
      {maintenance.enabled ? (
        <p
          role="status"
          className="border-b bg-destructive/10 px-4 py-2 text-center text-sm text-destructive"
        >
          {maintenanceMessage(config)}
        </p>
      ) : null}
      {announcement ? (
        <p
          role="status"
          className={cn(
            "border-b px-4 py-2 text-center text-sm",
            announcement.tone === "warning" ? "bg-foreground text-background" : "bg-muted",
          )}
        >
          {announcement.message}
        </p>
      ) : null}
    </div>
  );
}
