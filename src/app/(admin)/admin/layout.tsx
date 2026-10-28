import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { ThemeToggle } from "@/components/shared/theme-toggle";
import { AccountMenu } from "@/features/auth/components/account-menu";
import { AdminShell } from "@/features/admin/components/admin-shell";

export const metadata: Metadata = {
  title: { default: "Admin", template: "%s · Parley admin" },
  robots: { index: false, follow: false },
};

/** Staff area: its own header and navigation, separate from the public site. */
export default function AdminLayout({ children }: LayoutProps<"/admin">) {
  return (
    <div className="flex h-dvh flex-col">
      <header className="border-b">
        <div className="flex h-12 items-center justify-between gap-3 px-4">
          <div className="flex items-center gap-2">
            <Link href="/" className="rounded-sm text-[15px] font-semibold tracking-tight">
              Parley
            </Link>
            <span className="text-sm text-muted-foreground">Admin</span>
          </div>
          <div className="flex items-center gap-1">
            <ThemeToggle />
            <AccountMenu />
          </div>
        </div>
      </header>
      <main id="main" className="flex min-h-0 flex-1 flex-col">
        {/* The shell reads the pathname, which is request-time data on dynamic admin routes. */}
        <Suspense fallback={<Skeleton className="m-6 h-64" aria-label="Loading" />}>
          <AdminShell>{children}</AdminShell>
        </Suspense>
      </main>
    </div>
  );
}
