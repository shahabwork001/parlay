import type { Metadata } from "next";
import { AdminBilling } from "@/features/billing/components/admin-billing";
export const metadata: Metadata = { title: "Billing" };
export default function Page() {
  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-4 py-12">
      <AdminBilling />
    </div>
  );
}
