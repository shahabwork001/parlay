"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useSession } from "@/features/auth/hooks/use-session";
import { type Permission, permissionsFor } from "@/lib/permissions";
import { cn } from "@/lib/utils";

const NAV: readonly { href: string; label: string; permission: Permission }[] = [
  { href: "/admin", label: "Dashboard", permission: "dashboard.view" },
  { href: "/admin/reports", label: "Moderation queue", permission: "reports.review" },
  { href: "/admin/bans", label: "Bans and appeals", permission: "users.view" },
  { href: "/admin/users", label: "Users", permission: "users.view" },
  { href: "/admin/rules", label: "Word lists", permission: "rules.manage" },
  { href: "/admin/billing", label: "Billing", permission: "plans.manage" },
  { href: "/admin/site", label: "Site settings", permission: "flags.manage" },
  { href: "/admin/staff", label: "Staff", permission: "staff.manage" },
  { href: "/admin/audit", label: "Audit log", permission: "audit.view" },
  { href: "/admin/system", label: "System health", permission: "system.view" },
];

/** The current staff member's permissions (the API checks them again on every request). */
export function useAdminPermissions(): ReadonlySet<Permission> {
  const { principal } = useSession();
  return permissionsFor(principal?.roles ?? []);
}

function Gate({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="mx-auto flex max-w-md flex-col items-start gap-4 px-4 py-16">
      <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
      {children}
    </div>
  );
}

/**
 * Staff area frame: only staff on a two-factor session get past it. Navigation shows the sections
 * the staff member's roles allow.
 */
export function AdminShell({ children }: { children: ReactNode }) {
  const { isRestoring, isSignedIn, isStaff, principal } = useSession();
  const permissions = useAdminPermissions();
  const pathname = usePathname();

  if (isRestoring) {
    return (
      <div className="flex flex-1 gap-6 p-6" aria-busy="true" aria-label="Loading">
        <Skeleton className="hidden h-64 w-52 md:block" />
        <Skeleton className="h-64 flex-1" />
      </div>
    );
  }
  if (!isSignedIn) {
    return (
      <Gate title="Staff sign-in">
        <p className="text-sm text-muted-foreground">
          Sign in with your staff account to continue.
        </p>
        <Button asChild>
          <Link href="/login?next=/admin">Sign in</Link>
        </Button>
      </Gate>
    );
  }
  if (!isStaff) {
    return (
      <Gate title="This area is for staff">
        <p className="text-sm text-muted-foreground">Your account does not have a staff role.</p>
        <Button asChild variant="outline">
          <Link href="/">Back to Parley</Link>
        </Button>
      </Gate>
    );
  }
  if (!principal?.mfa) {
    return (
      <Gate title="Two-factor sign-in required">
        <p className="text-sm text-muted-foreground">
          Staff tools need a session that passed two-factor authentication. Set up an authenticator
          app on your account page, then sign out and sign in again with a code.
        </p>
        <Button asChild>
          <Link href="/account">Go to account</Link>
        </Button>
      </Gate>
    );
  }

  const items = NAV.filter((item) => permissions.has(item.permission));
  const isCurrent = (href: string) =>
    href === "/admin" ? pathname === href : pathname.startsWith(href);

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden md:flex-row">
      <nav
        aria-label="Admin"
        className="shrink-0 border-b md:w-56 md:overflow-y-auto md:border-r md:border-b-0"
      >
        <ul className="flex gap-1 overflow-x-auto p-2 md:flex-col md:p-3">
          {items.map((item) => (
            <li key={item.href} className="shrink-0">
              <Link
                href={item.href}
                aria-current={isCurrent(item.href) ? "page" : undefined}
                className={cn(
                  "block rounded-md px-3 py-2 text-sm transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                  isCurrent(item.href)
                    ? "bg-muted font-medium text-foreground"
                    : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
                )}
              >
                {item.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
      <div
        className="min-h-0 min-w-0 flex-1 overflow-y-auto overscroll-contain"
        role="region"
        aria-label="Admin content"
        tabIndex={0}
      >
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-6 sm:px-6">
          {children}
        </div>
      </div>
    </div>
  );
}

/** Shown inside a page when the staff member lacks its permission (direct link). */
export function RequirePermission({
  permission,
  children,
}: {
  permission: Permission;
  children: ReactNode;
}) {
  const permissions = useAdminPermissions();
  if (permissions.has(permission)) return <>{children}</>;
  return (
    <p className="rounded-lg border p-6 text-sm text-muted-foreground">
      Your role does not include access to this section.
    </p>
  );
}
