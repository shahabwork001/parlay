import type { Metadata } from "next";
import { RequirePermission } from "@/features/admin/components/admin-shell";
import { BansAdmin } from "@/features/admin/components/bans-admin";

export const metadata: Metadata = { title: "Bans and appeals" };

export default function BansPage() {
  return (
    <RequirePermission permission="users.view">
      <BansAdmin />
    </RequirePermission>
  );
}
