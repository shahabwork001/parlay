"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { useSession } from "@/features/auth/hooks/use-session";
import { errorMessage } from "@/lib/http/error-messages";
import { billingKeys, billingRepository } from "@/repositories/billing-repository";
import { mvpRepository } from "@/repositories/mvp-repository";
import { dollars } from "./membership";

const key = ["premium", "waitlist"] as const;
export function PlusPreview() {
  const { isSignedIn, principal } = useSession();
  const eligible = isSignedIn && principal?.emailVerified === true;
  const client = useQueryClient();
  const [consent, setConsent] = useState(false);
  const plans = useQuery({ queryKey: billingKeys.plans, queryFn: () => billingRepository.plans() });
  const list = useQuery({ queryKey: key, queryFn: mvpRepository.waitlist, enabled: eligible });
  const join = useMutation({
    mutationFn: mvpRepository.join,
    onSuccess: () => client.invalidateQueries({ queryKey: key }),
  });
  const leave = useMutation({
    mutationFn: mvpRepository.leave,
    onSuccess: () => {
      setConsent(false);
      return client.invalidateQueries({ queryKey: key });
    },
  });
  useEffect(() => {
    if (principal) void mvpRepository.preview().catch(() => undefined);
  }, [principal]);
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-5 py-8">
      <h1 className="text-3xl font-semibold">Parley Plus � pricing preview</h1>
      <p className="text-xl">
        Proposed {plans.data ? dollars(plans.data.plan.amountMinor) : "$9.99"} / month
      </p>
      <p>
        Parley is free while we validate demand. Plus is planned to add saved matching presets and
        personalization. Benefits and final pricing may change.
      </p>
      <p>
        Basic random chat, reporting, blocking and essential safety features stay free. Joining does
        not create a subscription or grant paid benefits. No card details or payments are collected.
      </p>
      <section className="flex flex-col gap-4 rounded-xl border bg-card p-6">
        <h2 className="text-xl font-medium">Interested in Plus?</h2>
        {!eligible ? (
          <p>
            <Link className="underline" href={isSignedIn ? "/account" : "/login?next=/pricing"}>
              {isSignedIn ? "Verify your account email" : "Sign in with a verified email account"}
            </Link>{" "}
            to join the private waitlist. No separate email form is needed.
          </p>
        ) : list.isPending ? (
          <p>Loading your waitlist status�</p>
        ) : list.error ? (
          <p role="alert">{errorMessage(list.error)}</p>
        ) : list.data.joined ? (
          <>
            <p role="status">You are on the Plus waitlist. No payment is due.</p>
            <Button variant="outline" disabled={leave.isPending} onClick={() => leave.mutate()}>
              Leave waitlist and remove my signup
            </Button>
          </>
        ) : (
          <>
            <label className="flex items-start gap-3 text-sm">
              <input
                type="checkbox"
                checked={consent}
                onChange={(e) => setConsent(e.target.checked)}
              />
              I want to register interest in Parley Plus. Store my account reference for up to 90
              days for demand measurement and a possible Plus availability notice. I can leave at
              any time. This is not consent to a paid subscription.
            </label>
            <Button disabled={!consent || join.isPending} onClick={() => join.mutate()}>
              Join Waitlist
            </Button>
          </>
        )}
        {(join.error || leave.error) && (
          <p role="alert">{errorMessage(join.error ?? leave.error)}</p>
        )}
        <p className="text-xs text-muted-foreground">
          The list is not public. We store your account reference, consent version and signup time;
          no copied email address, card information or conversation content. Signups expire after 90
          days.{" "}
          <Link className="underline" href="/privacy">
            Privacy details
          </Link>
          .
        </p>
      </section>
      <Button asChild variant="outline">
        <Link href="/">Start a free conversation</Link>
      </Button>
    </div>
  );
}
