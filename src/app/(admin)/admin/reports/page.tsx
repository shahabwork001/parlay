import type { Metadata } from "next";
import { RequirePermission } from "@/features/admin/components/admin-shell";
import { ReportQueue } from "@/features/admin/components/report-queue";

export const metadata: Metadata = { title: "Moderation queue" };

export default function ReportsPage() {
  return (
    <RequirePermission permission="reports.review">
      <ReportQueue />
    </RequirePermission>
  );
}
