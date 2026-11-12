"use client";

import { useQueryClient } from "@tanstack/react-query";
import { toDataURL } from "qrcode";
import { useState } from "react";
import { FormField } from "@/components/shared/form-field";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { setSession } from "@/lib/auth/session-store";
import { errorMessage } from "@/lib/http/error-messages";
import { totpField } from "@/lib/schemas/auth";
import { accountRepository } from "@/repositories/account-repository";
import { accountQueryKey } from "../hooks/use-account";

type Step =
  | { name: "intro" }
  | { name: "scan"; secret: string; qrDataUrl: string }
  | { name: "codes"; recoveryCodes: readonly string[] };

/** Three steps: start (secret + QR), confirm a first code, then show recovery codes exactly once. */
export function TwoFactorSetup() {
  const queryClient = useQueryClient();
  const [step, setStep] = useState<Step>({ name: "intro" });
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function start() {
    setBusy(true);
    setError(null);
    try {
      const setup = await accountRepository.startTwoFactorSetup();
      const qrDataUrl = await toDataURL(setup.otpauthUri, { margin: 1, width: 192 });
      setStep({ name: "scan", secret: setup.secret, qrDataUrl });
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setBusy(false);
    }
  }

  async function confirm(event: React.FormEvent) {
    event.preventDefault();
    const parsed = totpField.safeParse(code);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Enter the 6-digit code.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const enabled = await accountRepository.confirmTwoFactorSetup(parsed.data);
      setSession(enabled.session);
      setStep({ name: "codes", recoveryCodes: enabled.recoveryCodes });
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setBusy(false);
    }
  }

  if (step.name === "codes") {
    return (
      <div className="flex flex-col gap-4">
        <p className="text-sm text-muted-foreground">
          Two-factor authentication is on. Save these recovery codes somewhere safe. Each works once
          if you lose access to your authenticator app, and they will not be shown again.
        </p>
        <ul
          aria-label="Recovery codes"
          className="grid grid-cols-2 gap-2 rounded-lg border bg-muted p-4 font-mono text-sm"
        >
          {step.recoveryCodes.map((recoveryCode) => (
            <li key={recoveryCode}>{recoveryCode}</li>
          ))}
        </ul>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            onClick={() => void navigator.clipboard.writeText(step.recoveryCodes.join("\n"))}
          >
            Copy codes
          </Button>
          <Button onClick={() => void queryClient.invalidateQueries({ queryKey: accountQueryKey })}>
            I have saved them
          </Button>
        </div>
      </div>
    );
  }

  if (step.name === "scan") {
    return (
      <form onSubmit={(event) => void confirm(event)} className="flex flex-col gap-4" noValidate>
        <p className="text-sm text-muted-foreground">
          Scan this code with an authenticator app such as Aegis, 2FAS, Google Authenticator or
          1Password, then enter the 6-digit code it shows.
        </p>
        {/* eslint-disable-next-line @next/next/no-img-element -- local data URL, nothing to optimise */}
        <img
          src={step.qrDataUrl}
          alt="QR code for your authenticator app"
          width={192}
          height={192}
          className="rounded-md border"
        />
        <p className="text-xs text-muted-foreground">
          Cannot scan? Enter this key manually:{" "}
          <code className="rounded bg-muted px-1.5 py-0.5 font-mono break-all text-foreground">
            {step.secret}
          </code>
        </p>
        <FormField
          label="Code from your app"
          inputMode="numeric"
          autoComplete="one-time-code"
          value={code}
          onChange={(event) => setCode(event.target.value)}
        />
        {error ? (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}
        <Button type="submit" disabled={busy} className="self-start">
          {busy ? "Verifying" : "Turn on two-factor authentication"}
        </Button>
      </form>
    );
  }

  return (
    <div className="flex flex-col items-start gap-3">
      <p className="text-sm text-muted-foreground">
        Add a second step at sign-in with an authenticator app. Required for staff accounts.
      </p>
      {error ? (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}
      <Button onClick={() => void start()} disabled={busy}>
        {busy ? "Preparing" : "Set up two-factor authentication"}
      </Button>
    </div>
  );
}
