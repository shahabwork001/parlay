import type { Db, Collection } from "mongodb";
import type {
  BillingEvent,
  BillingStore,
  WebhookRecord,
} from "../../application/features/billing/contracts.js";
import { BillingError } from "../../application/features/billing/contracts.js";
import type { Payment, Plan, PreferencePreset, Subscription } from "../../domain/billing/membership.js";

type Stored<T> = T & { _id: string };
export class MongoBillingStore implements BillingStore {
  private readonly plans: Collection<Stored<Plan>>;
  private readonly subscriptions: Collection<Stored<Subscription>>;
  private readonly payments: Collection<Stored<Payment>>;
  private readonly events: Collection<Stored<WebhookRecord>>;
  constructor(
    db: Db,
    private readonly defaultAmount = 999,
  ) {
    this.plans = db.collection("plans");
    this.subscriptions = db.collection("subscriptions");
    this.payments = db.collection("payments");
    this.events = db.collection("processed_webhook_events");
  }
  async initialize(): Promise<void> {
    await this.subscriptions.createIndexes([
      { key: { userId: 1, requestKey: 1 }, unique: true, name: "user_checkout_unique" },
      {
        key: { userId: 1 },
        unique: true,
        partialFilterExpression: { status: { $in: ["pending", "active", "past_due"] } },
        name: "one_open_membership",
      },
      { key: { status: 1, currentPeriodEnd: 1 }, name: "subscription_expiry" },
      { key: { cancelRequestedAt: 1 }, name: "cancellation_retry" },
    ]);
    await this.payments.createIndex({ userId: 1, occurredAt: -1 });
    await this.events.createIndexes([
      { key: { completed: 1, receivedAt: 1 }, name: "pending_webhooks" },
      {
        key: { provider: 1, "event.subscriptionId": 1, "event.sequence": 1 },
        unique: true,
        name: "provider_subscription_revision",
      },
    ]);
    await this.plans.updateOne(
      { _id: "parley-plus" },
      {
        $setOnInsert: {
          id: "parley-plus",
          name: "Parley Plus",
          amountMinor: this.defaultAmount,
          currency: "USD",
          interval: "month",
          entitlements: ["preference_presets"],
        },
      },
      { upsert: true },
    );
  }
  async plan(): Promise<Plan> {
    const plan = await this.plans.findOne({ _id: "parley-plus" });
    if (!plan) throw new Error("Billing not initialized");
    return plan;
  }
  async savePlan(amountMinor: number): Promise<Plan> {
    await this.plans.updateOne({ _id: "parley-plus" }, { $set: { amountMinor } });
    return this.plan();
  }
  async subscription(id: string): Promise<Subscription | null> {
    return this.subscriptions.findOne({ _id: id });
  }
  async forUser(userId: string): Promise<Subscription[]> {
    return this.subscriptions.find({ userId }).sort({ createdAt: -1 }).limit(50).toArray();
  }
  async create(subscription: Subscription): Promise<Subscription> {
    try {
      await this.subscriptions.insertOne({ ...subscription, _id: subscription.id });
      return subscription;
    } catch (error) {
      if (typeof error === "object" && error !== null && "code" in error && error.code === 11000) {
        const existing = await this.subscriptions.findOne({
          userId: subscription.userId,
          requestKey: subscription.requestKey,
        });
        if (existing) return existing;
        throw new BillingError(409, "billing.existing", "A subscription already exists for this account.");
      }
      throw error;
    }
  }
  async cancellationRequested(id: string, at: string): Promise<void> {
    await this.subscriptions.updateOne(
      { _id: id, cancelRequestedAt: null },
      { $set: { cancelRequestedAt: at } },
    );
  }
  async savePresets(id: string, presets: PreferencePreset[]): Promise<void> {
    await this.subscriptions.updateOne({ _id: id }, { $set: { presets } });
  }
  async remember(record: WebhookRecord): Promise<WebhookRecord> {
    try {
      await this.events.insertOne({ ...record, _id: record.id });
      return record;
    } catch (error) {
      if (!(typeof error === "object" && error !== null && "code" in error && error.code === 11000))
        throw error;
      const existing = await this.events.findOne({ _id: record.id });
      if (!existing || JSON.stringify(existing.event) !== JSON.stringify(record.event))
        throw new BillingError(409, "billing.event_conflict", "Conflicting webhook event or revision.");
      return existing;
    }
  }
  async applySubscription(subscription: Subscription, event: BillingEvent): Promise<void> {
    await this.subscriptions.updateOne(
      { _id: subscription.id, revision: { $lt: event.sequence } },
      {
        $set: {
          ...event.subscription,
          revision: event.sequence,
          providerSubscriptionId: event.providerSubscriptionId,
        },
      },
    );
  }
  async applyPayment(payment: Payment): Promise<void> {
    // First insert establishes identity; updates cannot transfer a payment to a different account/subscription.
    await this.payments.updateOne(
      { _id: payment.id },
      { $setOnInsert: { ...payment, _id: payment.id, revision: -1 } },
      { upsert: true },
    );
    const existing = await this.payments.findOne({ _id: payment.id });
    if (existing?.subscriptionId !== payment.subscriptionId)
      throw new BillingError(409, "billing.payment_conflict", "Payment belongs to another subscription.");
    await this.payments.updateOne(
      { _id: payment.id, revision: { $lt: payment.revision } },
      { $set: payment },
    );
  }
  async complete(id: string): Promise<void> {
    await this.events.updateOne({ _id: id }, { $set: { completed: true } });
  }
  async pending(): Promise<WebhookRecord[]> {
    return this.events.find({ completed: false }).sort({ receivedAt: 1 }).limit(100).toArray();
  }
  async expire(now: string): Promise<void> {
    // Entitlements also check timestamps on every request; the sweep is for status visibility.
    await this.subscriptions.updateMany(
      { status: { $in: ["active", "cancelled", "past_due"] }, currentPeriodEnd: { $lte: now } },
      { $set: { status: "expired" } },
    );
    await this.subscriptions.updateMany(
      { status: "pending", checkoutExpiresAt: { $lte: now } },
      { $set: { status: "expired" } },
    );
  }
  async listSubscriptions(offset: number): Promise<Subscription[]> {
    return this.subscriptions.find().sort({ createdAt: -1, _id: 1 }).skip(offset).limit(50).toArray();
  }
  async listPayments(offset: number): Promise<Payment[]> {
    return this.payments.find().sort({ occurredAt: -1, _id: 1 }).skip(offset).limit(50).toArray();
  }
}
