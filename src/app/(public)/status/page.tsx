import type { Metadata } from "next";
import { SystemStatus } from "@/features/system-status/components/system-status";

export const metadata: Metadata = { title: "Status" };

export default function StatusPage() {
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-8 px-4 py-12 sm:px-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">System status</h1>
        <p className="text-sm text-muted-foreground">Refreshes every 15 seconds.</p>
      </div>
      <SystemStatus />
    </div>
  );
}
