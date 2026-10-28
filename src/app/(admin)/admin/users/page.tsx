import type { Metadata } from "next";
import { RequirePermission } from "@/features/admin/components/admin-shell";
import { UsersAdmin } from "@/features/admin/components/users-admin";

export const metadata: Metadata = { title: "Users" };

export default function UsersPage() {
  return (
    <RequirePermission permission="users.view">
      <UsersAdmin />
    </RequirePermission>
  );
}
