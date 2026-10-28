import type { Metadata } from "next";
import { RequirePermission } from "@/features/admin/components/admin-shell";
import { SystemHealth } from "@/features/admin/components/audit-and-system";

export const metadata: Metadata = { title: "System health" };

export default function SystemPage() {
  return (
    <RequirePermission permission="system.view">
      <SystemHealth />
    </RequirePermission>
  );
}
