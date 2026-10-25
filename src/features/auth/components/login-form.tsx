"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { FormField } from "@/components/shared/form-field";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { setSession } from "@/lib/auth/session-store";
import { errorCode, errorMessage } from "@/lib/http/error-messages";
import { emailField, recoveryCodeField, totpField } from "@/lib/schemas/auth";
import { authRepository } from "@/repositories/auth-repository";
import { getDeviceFingerprint } from "@/services/device-identity";

const credentialsSchema = z.object({
  email: emailField,
  password: z.string().min(1, "Enter your password."),
});
type Credentials = z.infer<typeof credentialsSchema>;

type SecondFactorMode = "totp" | "recovery";

/** Only same-origin relative paths are honoured as post-login destinations (no open redirects). */
function safeNext(next: string | null): string {
  return next?.startsWith("/") && !next.startsWith("//") ? next : "/";
}

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [error, setError] = useState<string | null>(null);
  const [credentials, setCredentials] = useState<Credentials | null>(null);
  const [secondFactor, setSecondFactor] = useState<SecondFactorMode>("totp");
  const [code, setCode] = useState("");
  const [codeError, setCodeError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const form = useForm<Credentials>({ resolver: zodResolver(credentialsSchema) });

  async function attempt(
    values: Credentials,
    factor?: { totpCode?: string; recoveryCode?: string },
  ) {
    setSubmitting(true);
    setError(null);
    try {
      const session = await authRepository.login({
        ...values,
        deviceFingerprint: await getDeviceFingerprint(),
        ...factor,
      });
      setSession(session);
      router.push(safeNext(searchParams.get("next")));
    } catch (caught) {
      if (errorCode(caught) === "auth.two_factor_required") {
        setCredentials(values);
        return;
      }
      setError(errorMessage(caught));
    } finally {
      setSubmitting(false);
    }
  }

  function submitSecondFactor(event: React.FormEvent) {
    event.preventDefault();
    if (!credentials) return;
    const parsed = (secondFactor === "totp" ? totpField : recoveryCodeField).safeParse(code);
    if (!parsed.success) {
      setCodeError(parsed.error.issues[0]?.message ?? "Invalid code.");
      return;
    }
    setCodeError(null);
    void attempt(
      credentials,
      secondFactor === "totp" ? { totpCode: parsed.data } : { recoveryCode: parsed.data },
    );
  }

  if (credentials) {
    return (
      <form onSubmit={submitSecondFactor} className="flex flex-col gap-4" noValidate>
        <p className="text-sm text-muted-foreground">
          {secondFactor === "totp"
            ? "Enter the 6-digit code from your authenticator app."
            : "Enter one of the recovery codes you saved when you set up two-factor authentication."}
        </p>
        <FormField
          label={secondFactor === "totp" ? "Authentication code" : "Recovery code"}
          value={code}
          onChange={(event) => setCode(event.target.value)}
          error={codeError ?? undefined}
          inputMode={secondFactor === "totp" ? "numeric" : "text"}
          autoComplete="one-time-code"
          autoFocus
        />
        {error ? (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}
        <Button type="submit" disabled={submitting}>
          {submitting ? "Verifying" : "Verify"}
        </Button>
        <Button
          type="button"
          variant="link"
          className="h-auto self-start p-0"
          onClick={() => {
            setSecondFactor(secondFactor === "totp" ? "recovery" : "totp");
            setCode("");
            setCodeError(null);
          }}
        >
          {secondFactor === "totp"
            ? "Use a recovery code instead"
            : "Use an authenticator code instead"}
        </Button>
      </form>
    );
  }

  return (
    <form
      onSubmit={form.handleSubmit((values) => attempt(values))}
      className="flex flex-col gap-4"
      noValidate
    >
      <FormField
        label="Email"
        type="email"
        autoComplete="email"
        error={form.formState.errors.email?.message}
        {...form.register("email")}
      />
      <FormField
        label="Password"
        type="password"
        autoComplete="current-password"
        error={form.formState.errors.password?.message}
        {...form.register("password")}
      />
      <Link
        href="/forgot-password"
        className="self-start text-sm text-muted-foreground underline-offset-2 hover:underline"
      >
        Forgot your password?
      </Link>
      {error ? (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}
      <Button type="submit" disabled={submitting}>
        {submitting ? "Signing in" : "Sign in"}
      </Button>
    </form>
  );
}
