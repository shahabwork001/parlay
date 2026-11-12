"use client";
import Link from "next/link";
import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useSession } from "@/features/auth/hooks/use-session";
import { usePreferencesStore } from "@/features/preferences/store/preferences-store";
import { isLanguageCode } from "@/lib/constants";
import { errorMessage } from "@/lib/http/error-messages";
import { billingKeys, billingRepository } from "@/repositories/billing-repository";
export const dollars = (minor: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(minor / 100);

export function Pricing() {
  const query = useQuery({ queryKey: billingKeys.plans, queryFn: () => billingRepository.plans() });
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 py-12">
      <h1 className="text-3xl font-semibold">Parley Plus</h1>
      <p>Keep your favourite matching preferences ready for your next conversation.</p>
      {query.isPending ? (
        <p>Loading pricing�</p>
      ) : query.error ? (
        <p role="alert">{errorMessage(query.error)}</p>
      ) : (
        <section className="flex flex-col gap-4 rounded-xl border bg-card p-6">
          <h2 className="text-2xl font-semibold">{dollars(query.data.plan.amountMinor)} / month</h2>
          <p>
            Save up to five matching preference presets for your interests and language. Plus does
            not bypass age verification, consent or moderation.
          </p>
          <p>Basic random chat, reporting, blocking and essential safety features stay free.</p>
          {!query.data.checkoutEnabled && (
            <p role="status">
              Checkout is unavailable until an approved payment processor is configured. No payments
              are collected.
            </p>
          )}
          {query.data.mock && (
            <p role="status">Development billing only. No real money or production membership.</p>
          )}
          <Button asChild variant="outline">
            <Link href="/subscription">Membership and saved presets</Link>
          </Button>
        </section>
      )}
    </div>
  );
}

export function Membership() {
  const { isSignedIn, isRestoring } = useSession();
  const client = useQueryClient();
  const [name, setName] = useState("");
  const requestKey = useRef<string | null>(null);
  const query = useQuery({
    queryKey: billingKeys.me,
    queryFn: () => billingRepository.me(),
    enabled: isSignedIn,
    refetchInterval: 15_000,
  });
  const checkout = useMutation({
    mutationFn: () => {
      requestKey.current ??= crypto.randomUUID();
      return billingRepository.checkout(requestKey.current);
    },
    onSuccess: ({ url }) => {
      window.location.assign(url);
    },
  });
  const cancel = useMutation({
    mutationFn: (id: string) => billingRepository.cancel(id),
    onSuccess: () => client.invalidateQueries({ queryKey: billingKeys.me }),
  });
  const save = useMutation({
    mutationFn: billingRepository.savePresets.bind(billingRepository),
    onSuccess: async () => {
      setName("");
      await client.invalidateQueries({ queryKey: billingKeys.me });
    },
  });
  if (isRestoring) return <p>Restoring your account�</p>;
  if (!isSignedIn)
    return (
      <p>
        <Link className="underline" href="/login?next=/subscription">
          Sign in
        </Link>{" "}
        with a verified email account to manage membership.
      </p>
    );
  if (query.isPending) return <p>Loading membership�</p>;
  if (query.error) return <p role="alert">{errorMessage(query.error)}</p>;
  const { subscription, plus, checkoutEnabled, mock } = query.data;
  return (
    <div className="flex flex-col gap-5">
      <p role="status">
        {plus ? "Parley Plus is active." : "You are using free Parley."}{" "}
        {subscription ? `Subscription: ${subscription.status}.` : ""}
      </p>
      {subscription?.currentPeriodEnd && (
        <p>Current paid period ends {new Date(subscription.currentPeriodEnd).toLocaleString()}.</p>
      )}
      {subscription?.cancelAtPeriodEnd && (
        <p>Cancellation confirmed. Access lasts until the paid period ends.</p>
      )}
      {subscription?.cancelRequestedAt && !subscription.cancelAtPeriodEnd && (
        <p>
          Cancellation requested; awaiting provider confirmation. Contact support if confirmation
          does not arrive.
        </p>
      )}
      {mock && (
        <p>
          Development mock only: returning from checkout does not confirm payment. Automated tests
          use signed mock webhooks. No card details are collected.
        </p>
      )}
      {!checkoutEnabled && (
        <p>Real checkout is disabled until an approved processor is configured.</p>
      )}
      {!plus && (
        <Button
          disabled={
            !checkoutEnabled ||
            checkout.isPending ||
            subscription?.status === "pending" ||
            subscription?.status === "past_due"
          }
          onClick={() => checkout.mutate()}
        >
          {mock ? "Start development checkout" : "Subscribe to Plus"}
        </Button>
      )}
      {subscription &&
        ["active", "past_due", "pending"].includes(subscription.status) &&
        !subscription.cancelRequestedAt && (
          <Button
            variant="outline"
            disabled={cancel.isPending || !checkoutEnabled}
            onClick={() => {
              if (window.confirm("Request cancellation of this subscription?"))
                cancel.mutate(subscription.id);
            }}
          >
            Cancel subscription
          </Button>
        )}
      {(checkout.error || cancel.error || save.error) && (
        <p role="alert">{errorMessage(checkout.error ?? cancel.error ?? save.error)}</p>
      )}
      <section className="flex flex-col gap-3 rounded-xl border p-5">
        <h2 className="text-lg font-medium">Saved matching presets</h2>
        <p className="text-sm text-muted-foreground">
          Choose interests and language on the homepage, then save them here. Adult consent is never
          included.
        </p>
        <Label htmlFor="preset-name">Preset name</Label>
        <Input
          id="preset-name"
          value={name}
          maxLength={40}
          onChange={(e) => setName(e.target.value)}
          disabled={!plus}
        />
        <Button
          disabled={
            !plus || !name.trim() || save.isPending || (subscription?.presets.length ?? 0) >= 5
          }
          onClick={() => {
            const { interests, language } = usePreferencesStore.getState();
            save.mutate([
              ...(subscription?.presets ?? []),
              { name: name.trim(), interests, language },
            ]);
          }}
        >
          Save current matching preferences
        </Button>
        {subscription?.presets.map((preset, index) => (
          <div key={`${index}:${preset.name}`} className="flex items-center justify-between gap-2">
            <span>
              {preset.name} � {preset.language}
            </span>
            <div className="flex gap-2">
              <Button
                variant="outline"
                disabled={!plus}
                onClick={() => {
                  if (isLanguageCode(preset.language))
                    usePreferencesStore.setState({
                      interests: preset.interests,
                      language: preset.language,
                    });
                }}
              >
                Use preset
              </Button>
              <Button
                variant="ghost"
                disabled={!plus || save.isPending}
                onClick={() => save.mutate(subscription.presets.filter((_, i) => index !== i))}
              >
                Remove
              </Button>
            </div>
          </div>
        ))}
      </section>
      <Link className="underline" href="/pricing">
        View pricing
      </Link>
    </div>
  );
}
