import type { Metadata } from "next";
import { RequirePermission } from "@/features/admin/components/admin-shell";
import { StaffAdmin } from "@/features/admin/components/staff-admin";

export const metadata: Metadata = { title: "Staff" };

export default function StaffPage() {
  return (
    <RequirePermission permission="staff.manage">
      <StaffAdmin />
    </RequirePermission>
  );
}
