import type { Metadata } from "next";
import { AccountSettings } from "@/features/account/components/account-settings";

export const metadata: Metadata = { title: "Account", robots: { index: false } };

export default function AccountPage() {
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-8 px-4 py-12 sm:px-6">
      <h1 className="text-2xl font-semibold tracking-tight">Account</h1>
      <AccountSettings />
    </div>
  );
}
