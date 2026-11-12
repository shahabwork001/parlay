import { randomUUID } from "node:crypto";
import { hasPlus } from "../../../domain/billing/membership.js";
import type { PreferencePreset, Subscription } from "../../../domain/billing/membership.js";
import { BillingError, billingEventSchema } from "./contracts.js";
import type { BillingEvent, BillingStore, PaymentProvider, WebhookRecord } from "./contracts.js";

export class BillingService {
  constructor(
    readonly store: BillingStore,
    readonly provider: PaymentProvider,
    readonly production: boolean,
    private readonly returnUrl: string,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async overview(userId: string) {
    const subscriptions = await this.store.forUser(userId);
    const subscription =
      subscriptions.find((item) => hasPlus(item, this.now(), this.production)) ?? subscriptions[0] ?? null;
    return {
      subscription,
      plus: hasPlus(subscription, this.now(), this.production),
      checkoutEnabled: this.checkoutEnabled,
      mock: this.provider.id === "mock",
    };
  }
  get checkoutEnabled(): boolean {
    return this.provider.checkoutEnabled && !(this.production && this.provider.id === "mock");
  }

  async checkout(userId: string, requestKey: string): Promise<{ url: string }> {
    if (!this.checkoutEnabled)
      throw new BillingError(
        503,
        "billing.unavailable",
        "Checkout is disabled until an approved processor is configured.",
      );
    await this.store.expire(this.now().toISOString());
    const prior = await this.store.forUser(userId);
    let subscription = prior.find((item) => item.requestKey === requestKey);
    if (subscription && subscription.status !== "pending")
      throw new BillingError(
        409,
        "billing.completed",
        "This checkout has already completed. Refresh membership status.",
      );
    if (
      !subscription &&
      prior.some(
        (item) =>
          item.status === "pending" ||
          hasPlus(item, this.now(), this.production) ||
          item.status === "past_due",
      )
    )
      throw new BillingError(
        409,
        "billing.existing",
        "Manage your existing subscription before starting another.",
      );
    const plan = await this.store.plan();
    subscription ??= await this.store.create({
      id: randomUUID(),
      userId,
      requestKey,
      planId: plan.id,
      provider: this.provider.id,
      amountMinor: plan.amountMinor,
      currency: plan.currency,
      status: "pending",
      revision: 0,
      providerSubscriptionId: null,
      currentPeriodStart: null,
      currentPeriodEnd: null,
      cancelAtPeriodEnd: false,
      cancelRequestedAt: null,
      createdAt: this.now().toISOString(),
      checkoutExpiresAt: new Date(this.now().getTime() + 60 * 60_000).toISOString(),
      presets: [],
    });
    // A retried checkout retains its original price, even if the administrator changes the plan.
    return this.provider.createCheckout({
      subscription,
      plan: { ...plan, amountMinor: subscription.amountMinor },
      returnUrl: this.returnUrl,
      idempotencyKey: subscription.id,
    });
  }

  async cancel(userId: string, id: string): Promise<void> {
    const subscription = await this.owned(userId, id);
    if (!this.checkoutEnabled || subscription.provider !== this.provider.id)
      throw new BillingError(
        503,
        "billing.unavailable",
        "The billing provider is unavailable. Contact support for cancellation assistance.",
      );
    if (subscription.cancelAtPeriodEnd || ["expired", "refunded"].includes(subscription.status)) return;
    // Persist intent first. Reconciliation retries a provider timeout using the same idempotency key.
    await this.store.cancellationRequested(id, this.now().toISOString());
    await this.provider.cancelSubscription({ subscription, idempotencyKey: `cancel:${id}` });
    // Only a verified provider snapshot confirms cancellation. Never extend entitlement locally.
  }
  async savePresets(userId: string, presets: PreferencePreset[]): Promise<void> {
    const current = await this.overview(userId);
    if (!current.plus || !current.subscription)
      throw new BillingError(
        403,
        "billing.plus_required",
        "Parley Plus is required for saved matching presets.",
      );
    await this.store.savePresets(current.subscription.id, presets);
  }
  async owned(userId: string, id: string): Promise<Subscription> {
    const subscription = await this.store.subscription(id);
    if (!subscription || subscription.userId !== userId)
      throw new BillingError(404, "billing.not_found", "Subscription not found.");
    return subscription;
  }

  async webhook(raw: Buffer, headers: Readonly<Record<string, string | undefined>>): Promise<void> {
    if (!this.checkoutEnabled) throw new BillingError(503, "billing.unavailable", "Billing is disabled.");
    let event: BillingEvent;
    try {
      event = billingEventSchema.parse(await this.provider.verifyWebhook(raw, headers));
    } catch {
      throw new BillingError(400, "billing.invalid_webhook", "Invalid webhook signature or event.");
    }
    const subscription = await this.store.subscription(event.subscriptionId);
    if (!subscription || subscription.provider !== this.provider.id)
      throw new BillingError(400, "billing.unknown_subscription", "Unknown subscription.");
    if (
      subscription.providerSubscriptionId &&
      subscription.providerSubscriptionId !== event.providerSubscriptionId
    )
      throw new BillingError(409, "billing.provider_mismatch", "Subscription reference mismatch.");
    if (event.payment && event.payment.amountMinor !== subscription.amountMinor)
      throw new BillingError(
        400,
        "billing.amount_mismatch",
        "Payment amount does not match the agreed price.",
      );
    const record = await this.store.remember({
      id: `${this.provider.id}:${event.id}`,
      provider: this.provider.id,
      event,
      completed: false,
      receivedAt: this.now().toISOString(),
    });
    await this.process(record);
  }
  private async process(record: WebhookRecord): Promise<void> {
    if (record.completed) return;
    const subscription = await this.store.subscription(record.event.subscriptionId);
    if (!subscription || subscription.provider !== record.provider)
      throw new Error("Billing inbox references an unknown subscription");
    const event = record.event;
    // Each projection has its own monotonic revision guard. Retry completes any missing effect.
    if (event.payment)
      await this.store.applyPayment({
        ...event.payment,
        id: `${record.provider}:${event.payment.id}`,
        providerPaymentId: event.payment.id,
        provider: record.provider,
        subscriptionId: subscription.id,
        userId: subscription.userId,
        revision: event.sequence,
        occurredAt: event.occurredAt,
      });
    await this.store.applySubscription(subscription, event);
    await this.store.complete(record.id);
  }
  async reconcile(): Promise<void> {
    await this.store.expire(this.now().toISOString());
    for (const record of await this.store.pending()) {
      if (record.provider !== this.provider.id || (this.production && record.provider === "mock")) continue;
      await this.process(record);
    }
    if (!this.checkoutEnabled) return;
    for (const subscription of await this.store.listSubscriptions(0)) {
      if (
        subscription.provider === this.provider.id &&
        subscription.cancelRequestedAt &&
        !subscription.cancelAtPeriodEnd &&
        ["active", "past_due", "pending"].includes(subscription.status)
      )
        await this.provider.cancelSubscription({ subscription, idempotencyKey: `cancel:${subscription.id}` });
    }
  }
}
