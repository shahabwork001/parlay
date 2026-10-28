import type { Metadata } from "next";
import { RequirePermission } from "@/features/admin/components/admin-shell";
import { SiteSettings } from "@/features/admin/components/site-settings";

export const metadata: Metadata = { title: "Site settings" };

export default function SiteSettingsPage() {
  return (
    <RequirePermission permission="flags.manage">
      <SiteSettings />
    </RequirePermission>
  );
}
