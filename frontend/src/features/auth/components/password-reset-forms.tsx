"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { FormField } from "@/components/shared/form-field";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { errorMessage } from "@/lib/http/error-messages";
import { emailField, newPasswordField } from "@/lib/schemas/auth";
import { authRepository } from "@/repositories/auth-repository";

const forgotSchema = z.object({ email: emailField });

export function ForgotPasswordForm() {
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const form = useForm<z.infer<typeof forgotSchema>>({ resolver: zodResolver(forgotSchema) });

  async function submit(values: z.infer<typeof forgotSchema>) {
    setError(null);
    try {
      await authRepository.requestPasswordReset(values.email);
      setSent(true);
    } catch (caught) {
      setError(errorMessage(caught));
    }
  }

  if (sent) {
    return (
      <p role="status" className="rounded-xl border p-5 text-sm text-muted-foreground">
        If an account exists for that address, we have sent a link to reset the password. It expires
        in 1 hour.
      </p>
    );
  }

  return (
    <form onSubmit={form.handleSubmit(submit)} className="flex flex-col gap-4" noValidate>
      <FormField
        label="Email"
        type="email"
        autoComplete="email"
        error={form.formState.errors.email?.message}
        {...form.register("email")}
      />
      {error ? (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}
      <Button type="submit" disabled={form.formState.isSubmitting}>
        {form.formState.isSubmitting ? "Sending" : "Send reset link"}
      </Button>
    </form>
  );
}

const resetSchema = z
  .object({ password: newPasswordField, confirmPassword: z.string() })
  .refine((values) => values.password === values.confirmPassword, {
    path: ["confirmPassword"],
    message: "Passwords do not match.",
  });

export function ResetPasswordForm() {
  const token = useSearchParams().get("token");
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const form = useForm<z.infer<typeof resetSchema>>({ resolver: zodResolver(resetSchema) });

  if (!token) {
    return (
      <Alert variant="destructive">
        <AlertDescription>
          This reset link is incomplete.{" "}
          <Link href="/forgot-password" className="underline">
            Request a new one
          </Link>
          .
        </AlertDescription>
      </Alert>
    );
  }

  async function submit(values: z.infer<typeof resetSchema>) {
    if (!token) return;
    setError(null);
    try {
      await authRepository.resetPassword(token, values.password);
      setDone(true);
    } catch (caught) {
      setError(errorMessage(caught));
    }
  }

  if (done) {
    return (
      <div role="status" className="flex flex-col gap-4 rounded-xl border p-5">
        <p className="text-sm text-muted-foreground">
          Your password has been changed and you have been signed out everywhere.
        </p>
        <Button asChild>
          <Link href="/login">Sign in</Link>
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={form.handleSubmit(submit)} className="flex flex-col gap-4" noValidate>
      <FormField
        label="New password"
        type="password"
        autoComplete="new-password"
        hint="At least 10 characters."
        error={form.formState.errors.password?.message}
        {...form.register("password")}
      />
      <FormField
        label="Confirm new password"
        type="password"
        autoComplete="new-password"
        error={form.formState.errors.confirmPassword?.message}
        {...form.register("confirmPassword")}
      />
      {error ? (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}
      <Button type="submit" disabled={form.formState.isSubmitting}>
        {form.formState.isSubmitting ? "Saving" : "Set new password"}
      </Button>
    </form>
  );
}
