import type { Metadata } from "next";
import { AdminDashboard } from "@/features/admin/components/admin-dashboard";
import { RequirePermission } from "@/features/admin/components/admin-shell";

export const metadata: Metadata = { title: "Dashboard" };

export default function AdminDashboardPage() {
  return (
    <RequirePermission permission="dashboard.view">
      <AdminDashboard />
    </RequirePermission>
  );
}
