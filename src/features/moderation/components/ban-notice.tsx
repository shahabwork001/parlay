"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { useSession } from "@/features/auth/hooks/use-session";
import { errorMessage } from "@/lib/http/error-messages";
import {
  type Ban,
  type BanReason,
  moderationRepository,
} from "@/repositories/moderation-repository";

export const banQueryKey = ["moderation", "my-ban"] as const;

const REASONS: Record<BanReason, string> = {
  "pending-review":
    "A report about you is being reviewed. Your access is suspended until a moderator decides.",
  nudity: "Nudity or sexual acts on camera.",
  "sexual-content": "Sexual messages or requests.",
  harassment: "Harassing or bullying other people.",
  hate: "Hate speech or slurs.",
  violence: "Threats or violence.",
  spam: "Spam or automated messages.",
  scam: "Scams, fraud or advertising.",
  "minor-safety": "Content that endangers minors.",
  underage: "Parley is for adults only.",
  "repeated-flags": "Our automatic screening flagged your video several times.",
  "repeated-reports": "Several people reported you in a short time.",
  other: "Breaking the Community Guidelines.",
};

const dateFormat = new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" });

function duration(ban: Ban): string {
  if (ban.reason === "pending-review" && ban.expiresAt === null)
    return "Until the review is complete";
  if (ban.expiresAt === null) return "Permanent";
  return `Until ${dateFormat.format(new Date(ban.expiresAt))}`;
}

const MIN_APPEAL_LENGTH = 20;

function AppealForm() {
  const queryClient = useQueryClient();
  const [message, setMessage] = useState("");
  const [tooShort, setTooShort] = useState(false);
  const appeal = useMutation({
    mutationFn: (text: string) => moderationRepository.appeal(text),
    onSuccess: (ban) => queryClient.setQueryData(banQueryKey, ban),
  });

  function submit(event: React.FormEvent) {
    event.preventDefault();
    if (message.trim().length < MIN_APPEAL_LENGTH) {
      setTooShort(true);
      return;
    }
    appeal.mutate(message.trim());
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-3" noValidate>
      <Label htmlFor="appeal-message">Appeal this decision</Label>
      <p id="appeal-hint" className="text-sm text-muted-foreground">
        Tell us why you think this was a mistake. A moderator reads every appeal; you can send one
        per ban.
      </p>
      <Textarea
        id="appeal-message"
        rows={5}
        maxLength={2000}
        value={message}
        aria-invalid={tooShort}
        aria-describedby={tooShort ? "appeal-hint appeal-error" : "appeal-hint"}
        onChange={(event) => {
          setMessage(event.target.value);
          setTooShort(false);
        }}
      />
      {tooShort ? (
        <p id="appeal-error" className="text-xs text-destructive">
          Tell us a bit more (at least {MIN_APPEAL_LENGTH} characters).
        </p>
      ) : null}
      {appeal.isError ? (
        <p role="alert" className="text-sm text-destructive">
          {errorMessage(appeal.error)}
        </p>
      ) : null}
      <Button type="submit" className="self-start" disabled={appeal.isPending}>
        {appeal.isPending ? "Sending appeal" : "Send appeal"}
      </Button>
    </form>
  );
}

function BanDetails({ ban }: { ban: Ban }) {
  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">Your access to chat is suspended</h1>
        <p className="text-sm text-muted-foreground">
          This applies to your account and this device.
        </p>
      </div>

      <dl className="grid gap-4 rounded-xl border p-5 text-sm sm:grid-cols-[10rem_1fr]">
        <dt className="font-medium">Reason</dt>
        <dd className="text-muted-foreground">
          {REASONS[ban.reason]}
          {ban.message ? <span className="mt-1 block">{ban.message}</span> : null}
        </dd>
        <dt className="font-medium">Since</dt>
        <dd className="text-muted-foreground">{dateFormat.format(new Date(ban.startedAt))}</dd>
        <dt className="font-medium">Duration</dt>
        <dd className="text-muted-foreground">{duration(ban)}</dd>
      </dl>

      {ban.appeal ? (
        <Alert>
          <AlertDescription>
            {ban.appeal.status === "pending"
              ? `Your appeal from ${dateFormat.format(new Date(ban.appeal.submittedAt))} is waiting for a moderator. We will lift the ban if it was a mistake.`
              : ban.appeal.status === "rejected"
                ? "Your appeal was reviewed and the ban stays in place."
                : "Your appeal was accepted."}
          </AlertDescription>
        </Alert>
      ) : ban.appealable ? (
        <AppealForm />
      ) : null}

      <p className="text-sm text-muted-foreground">
        Read the{" "}
        <Link href="/guidelines" className="underline underline-offset-4">
          Community Guidelines
        </Link>{" "}
        or{" "}
        <Link href="/contact" className="underline underline-offset-4">
          contact us
        </Link>
        .
      </p>
    </div>
  );
}

/** The ban a person sees after being disconnected, with the reason, the duration and an appeal. */
export function BanNotice() {
  const { session, isRestoring } = useSession();
  const query = useQuery({
    queryKey: banQueryKey,
    queryFn: ({ signal }) => moderationRepository.getMyBan(signal),
    enabled: session !== null,
  });

  if (isRestoring || (session !== null && query.isPending)) {
    return (
      <div className="flex flex-col gap-4" aria-busy="true" aria-label="Loading">
        <Skeleton className="h-8 w-3/4" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  if (query.isError) {
    return (
      <div className="flex flex-col items-start gap-3">
        <p role="alert" className="text-sm text-destructive">
          {errorMessage(query.error)}
        </p>
        <Button variant="outline" onClick={() => void query.refetch()}>
          Try again
        </Button>
      </div>
    );
  }

  if (!query.data) {
    return (
      <div className="flex flex-col items-start gap-4">
        <h1 className="text-2xl font-semibold tracking-tight">You are not banned</h1>
        <p className="text-sm text-muted-foreground">
          There is no active ban on your account or this device.
        </p>
        <Button asChild>
          <Link href="/">Start chatting</Link>
        </Button>
      </div>
    );
  }

  return <BanDetails ban={query.data} />;
}
