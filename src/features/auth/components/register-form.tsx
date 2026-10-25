"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import { FormField } from "@/components/shared/form-field";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { errorMessage, fieldErrors } from "@/lib/http/error-messages";
import { emailField, newPasswordField } from "@/lib/schemas/auth";
import { authRepository } from "@/repositories/auth-repository";
import { ConsentCheckbox } from "./consent-checkbox";

const registerSchema = z
  .object({
    email: emailField,
    password: newPasswordField,
    confirmPassword: z.string(),
    ageConfirmed: z.literal(true, { error: "You must be 18 or older to use Parley." }),
    termsAccepted: z.literal(true, {
      error: "Accept the Terms and Community Guidelines to continue.",
    }),
  })
  .refine((values) => values.password === values.confirmPassword, {
    path: ["confirmPassword"],
    message: "Passwords do not match.",
  });

type RegisterValues = z.input<typeof registerSchema>;

export function RegisterForm() {
  const [submittedEmail, setSubmittedEmail] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const form = useForm<RegisterValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: { email: "", password: "", confirmPassword: "" },
  });

  async function submit(values: RegisterValues) {
    setError(null);
    try {
      await authRepository.register(values.email, values.password);
      setSubmittedEmail(values.email);
    } catch (caught) {
      const fields = fieldErrors(caught);
      for (const [name, message] of Object.entries(fields)) {
        if (name === "email" || name === "password") form.setError(name, { message });
      }
      setError(errorMessage(caught));
    }
  }

  if (submittedEmail) {
    return (
      <div role="status" className="flex flex-col gap-3 rounded-xl border p-5">
        <p className="text-sm font-medium">Check your email</p>
        <p className="text-sm text-muted-foreground">
          We sent a confirmation link to {submittedEmail}. Open it to finish creating your account,
          then sign in. The link expires in 24 hours.
        </p>
      </div>
    );
  }

  const { errors, isSubmitting } = form.formState;

  return (
    <form onSubmit={form.handleSubmit(submit)} className="flex flex-col gap-4" noValidate>
      <FormField
        label="Email"
        type="email"
        autoComplete="email"
        error={errors.email?.message}
        {...form.register("email")}
      />
      <FormField
        label="Password"
        type="password"
        autoComplete="new-password"
        hint="At least 10 characters. A few unrelated words work well."
        error={errors.password?.message}
        {...form.register("password")}
      />
      <FormField
        label="Confirm password"
        type="password"
        autoComplete="new-password"
        error={errors.confirmPassword?.message}
        {...form.register("confirmPassword")}
      />
      <Controller
        control={form.control}
        name="ageConfirmed"
        render={({ field, fieldState }) => (
          <ConsentCheckbox
            checked={field.value === true}
            onCheckedChange={field.onChange}
            error={fieldState.error?.message}
          >
            I am 18 or older.
          </ConsentCheckbox>
        )}
      />
      <Controller
        control={form.control}
        name="termsAccepted"
        render={({ field, fieldState }) => (
          <ConsentCheckbox
            checked={field.value === true}
            onCheckedChange={field.onChange}
            error={fieldState.error?.message}
          >
            I agree to the{" "}
            <Link href="/terms" className="underline underline-offset-2" target="_blank">
              Terms
            </Link>{" "}
            and{" "}
            <Link href="/guidelines" className="underline underline-offset-2" target="_blank">
              Community Guidelines
            </Link>
            .
          </ConsentCheckbox>
        )}
      />
      {error ? (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}
      <Button type="submit" disabled={isSubmitting}>
        {isSubmitting ? "Creating account" : "Create account"}
      </Button>
    </form>
  );
}
