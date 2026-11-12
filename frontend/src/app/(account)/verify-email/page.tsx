import type { Metadata } from "next";
import { Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { AuthCard } from "@/features/auth/components/auth-card";
import { VerifyEmailStatus } from "@/features/auth/components/verify-email-status";

export const metadata: Metadata = { title: "Confirm email" };

export default function VerifyEmailPage() {
  return (
    <AuthCard title="Confirm your email">
      <Suspense fallback={<Skeleton className="h-16 w-full" />}>
        <VerifyEmailStatus />
      </Suspense>
    </AuthCard>
  );
}
