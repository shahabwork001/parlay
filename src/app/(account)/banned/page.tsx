import type { Metadata } from "next";
import { BanNotice } from "@/features/moderation/components/ban-notice";

export const metadata: Metadata = { title: "Access suspended", robots: { index: false } };

export default function BannedPage() {
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col px-4 py-12 sm:px-6">
      <BanNotice />
    </div>
  );
}
