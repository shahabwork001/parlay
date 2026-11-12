"use client";

import { useMutation } from "@tanstack/react-query";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useRef } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { errorMessage } from "@/lib/http/error-messages";
import { authRepository } from "@/repositories/auth-repository";

export function VerifyEmailStatus() {
  const token = useSearchParams().get("token");
  const { mutate, status, error } = useMutation({
    mutationFn: (value: string) => authRepository.verifyEmail(value),
  });

  // Tokens are single-use: submit once even when effects run twice (React Strict Mode).
  const submitted = useRef(false);
  useEffect(() => {
    if (!token || submitted.current) return;
    submitted.current = true;
    mutate(token);
  }, [token, mutate]);

  if (!token) {
    return (
      <Alert variant="destructive">
        <AlertDescription>
          This confirmation link is incomplete. Open the link from your email again.
        </AlertDescription>
      </Alert>
    );
  }

  if (status === "idle" || status === "pending") {
    return <Skeleton className="h-16 w-full" aria-label="Confirming your email" />;
  }

  if (status === "error") {
    return (
      <Alert variant="destructive">
        <AlertDescription>
          {errorMessage(error)} Sign in to send a new confirmation email.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div role="status" className="flex flex-col gap-4 rounded-xl border p-5">
      <p className="text-sm text-muted-foreground">Your email is confirmed. You can sign in now.</p>
      <Button asChild>
        <Link href="/login">Sign in</Link>
      </Button>
    </div>
  );
}
