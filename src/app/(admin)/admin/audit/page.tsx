import type { Metadata } from "next";
import { RequirePermission } from "@/features/admin/components/admin-shell";
import { AuditLog } from "@/features/admin/components/audit-and-system";

export const metadata: Metadata = { title: "Audit log" };

export default function AuditPage() {
  return (
    <RequirePermission permission="audit.view">
      <AuditLog />
    </RequirePermission>
  );
}
