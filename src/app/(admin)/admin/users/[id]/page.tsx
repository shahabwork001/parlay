import type { Metadata } from "next";
import { Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { RequirePermission } from "@/features/admin/components/admin-shell";
import { UserDetailView } from "@/features/admin/components/users-admin";

export const metadata: Metadata = { title: "User" };

async function UserDetailRoute({ params }: { params: PageProps<"/admin/users/[id]">["params"] }) {
  const { id } = await params;
  return <UserDetailView userId={id} />;
}

export default function UserPage({ params }: PageProps<"/admin/users/[id]">) {
  return (
    <RequirePermission permission="users.view">
      <Suspense fallback={<Skeleton className="h-64 w-full" aria-label="Loading" />}>
        <UserDetailRoute params={params} />
      </Suspense>
    </RequirePermission>
  );
}
