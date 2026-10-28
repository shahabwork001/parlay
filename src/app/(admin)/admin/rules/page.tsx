import type { Metadata } from "next";
import { RequirePermission } from "@/features/admin/components/admin-shell";
import { RulesEditor } from "@/features/admin/components/rules-editor";

export const metadata: Metadata = { title: "Word lists" };

export default function RulesPage() {
  return (
    <RequirePermission permission="rules.manage">
      <RulesEditor />
    </RequirePermission>
  );
}
