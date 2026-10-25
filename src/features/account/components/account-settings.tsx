"use client";

import { useMutation } from "@tanstack/react-query";
import Link from "next/link";
import type { ReactNode } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useSession } from "@/features/auth/hooks/use-session";
import { errorMessage } from "@/lib/http/error-messages";
import { authRepository } from "@/repositories/auth-repository";
import { useAccount } from "../hooks/use-account";
import { TwoFactorSetup } from "./two-factor-setup";

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section aria-labelledby={`${title}-heading`} className="flex flex-col gap-4 border-t pt-6">
      <h2 id={`${title}-heading`} className="text-sm font-medium">
        {title}
      </h2>
      {children}
    </section>
  );
}

function ResendVerification() {
  const resend = useMutation({ mutationFn: () => authRepository.resendVerification() });
  if (resend.isSuccess)
    return <p className="text-sm text-muted-foreground">Confirmation email sent.</p>;
  return (
    <div className="flex flex-col items-start gap-2">
      <Button
        variant="outline"
        size="sm"
        onClick={() => resend.mutate()}
        disabled={resend.isPending}
      >
        {resend.isPending ? "Sending" : "Resend confirmation email"}
      </Button>
      {resend.isError ? (
        <p className="text-xs text-destructive">{errorMessage(resend.error)}</p>
      ) : null}
    </div>
  );
}

export function AccountSettings() {
  const { isRestoring, isSignedIn, isStaff } = useSession();
  const query = useAccount();

  if (isRestoring || (isSignedIn && query.isPending)) {
    return (
      <div className="flex flex-col gap-4" aria-busy="true" aria-label="Loading account">
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }

  if (!isSignedIn) {
    return (
      <div className="flex flex-col items-start gap-4 rounded-xl border p-6">
        <p className="text-sm text-muted-foreground">Sign in to manage your account.</p>
        <Button asChild>
          <Link href="/login?next=/account">Sign in</Link>
        </Button>
      </div>
    );
  }

  if (query.isError) {
    return (
      <div role="alert" className="flex flex-col items-start gap-3 rounded-xl border p-6">
        <p className="text-sm">{errorMessage(query.error)}</p>
        <Button variant="outline" onClick={() => void query.refetch()}>
          Retry
        </Button>
      </div>
    );
  }

  const account = query.data;
  if (!account) return null;

  return (
    <div className="flex flex-col gap-6">
      {isStaff && !account.mfa ? (
        <Alert>
          <AlertDescription>
            Staff access requires two-factor authentication. Set it up below to use staff tools.
          </AlertDescription>
        </Alert>
      ) : null}

      <Section title="Email">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm">{account.email}</span>
          <Badge variant={account.emailVerified ? "secondary" : "outline"}>
            {account.emailVerified ? "Confirmed" : "Not confirmed"}
          </Badge>
          {account.roles.map((role) => (
            <Badge key={role} variant="outline">
              {role}
            </Badge>
          ))}
        </div>
        {account.emailVerified ? null : <ResendVerification />}
      </Section>

      <Section title="Terms">
        <p className="text-sm text-muted-foreground">
          {account.termsCurrent
            ? `You accepted the current Terms and Community Guidelines (version ${account.currentTermsVersion}).`
            : "The Terms have changed. You will be asked to accept them before your next chat."}
        </p>
      </Section>

      <Section title="Two-factor authentication">
        {account.twoFactorEnabled ? (
          <div className="flex items-center gap-2">
            <Badge variant="secondary">On</Badge>
            <span className="text-sm text-muted-foreground">
              You are asked for a code each time you sign in.
            </span>
          </div>
        ) : (
          <TwoFactorSetup />
        )}
      </Section>
    </div>
  );
}
