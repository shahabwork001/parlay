import { z } from "zod";
import type { Payment, Plan, PreferencePreset, Subscription } from "../../../domain/billing/membership.js";

const reference = z
  .string()
  .min(1)
  .max(200)
  .regex(/^[a-zA-Z0-9_.:-]+$/);
const timestamp = z.iso.datetime().transform((value) => new Date(value).toISOString());
const money = z.number().int().min(0).max(100_000_000);
/** Adapters must supply a complete authoritative snapshot and strictly increasing revision per subscription.
 * Fetch authoritative provider state if its webhook does not carry that information. No raw/card payloads.
 */
export const billingEventSchema = z
  .object({
    id: reference,
    subscriptionId: z.uuid(),
    providerSubscriptionId: reference,
    sequence: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
    occurredAt: timestamp,
    kind: z.enum(["activated", "renewed", "cancelled", "expired", "refunded", "payment_failed"]),
    subscription: z
      .object({
        status: z.enum(["active", "past_due", "cancelled", "expired", "refunded"]),
        currentPeriodStart: timestamp,
        currentPeriodEnd: timestamp,
        cancelAtPeriodEnd: z.boolean(),
      })
      .strict(),
    payment: z
      .object({
        id: reference,
        amountMinor: money,
        refundedMinor: money,
        currency: z.literal("USD"),
        status: z.enum(["paid", "failed", "partially_refunded", "refunded"]),
      })
      .strict()
      .nullable(),
  })
  .strict()
  .superRefine((event, ctx) => {
    const issue = (message: string) => {
      ctx.addIssue({ code: "custom", message });
    };
    if (event.subscription.currentPeriodEnd <= event.subscription.currentPeriodStart)
      issue("Invalid billing period");
    if (
      (event.kind === "activated" || event.kind === "renewed") &&
      (event.subscription.status !== "active" || event.payment?.status !== "paid")
    )
      issue("Activation/renewal requires paid active state");
    if (
      event.kind === "payment_failed" &&
      (event.subscription.status !== "past_due" || event.payment?.status !== "failed")
    )
      issue("Failure requires past_due state");
    if (event.kind === "expired" && event.subscription.status !== "expired") issue("Invalid expired state");
    if (event.kind === "cancelled" && event.subscription.status !== "cancelled")
      issue("Invalid cancellation state");
    if (
      event.kind === "refunded" &&
      !["refunded", "partially_refunded"].includes(event.payment?.status ?? "")
    )
      issue("Refund requires a payment refund");
    if (event.payment) {
      const { amountMinor, refundedMinor, status } = event.payment;
      if (refundedMinor > amountMinor) issue("Refund exceeds payment");
      if (status === "refunded" && (amountMinor === 0 || refundedMinor !== amountMinor))
        issue("Invalid full refund");
      if (status === "partially_refunded" && (refundedMinor <= 0 || refundedMinor >= amountMinor))
        issue("Invalid partial refund");
      if ((status === "paid" || status === "failed") && refundedMinor !== 0) issue("Unexpected refund");
    }
  });
export type BillingEvent = z.infer<typeof billingEventSchema>;
export interface PaymentProvider {
  readonly id: string;
  readonly checkoutEnabled: boolean;
  createCheckout(input: {
    subscription: Subscription;
    plan: Plan;
    returnUrl: string;
    idempotencyKey: string;
  }): Promise<{ url: string }>;
  cancelSubscription(input: { subscription: Subscription; idempotencyKey: string }): Promise<void>;
  verifyWebhook(rawBody: Buffer, headers: Readonly<Record<string, string | undefined>>): Promise<unknown>;
}
export interface WebhookRecord {
  id: string;
  provider: string;
  event: BillingEvent;
  completed: boolean;
  receivedAt: string;
}
export interface BillingStore {
  plan(): Promise<Plan>;
  savePlan(amountMinor: number): Promise<Plan>;
  subscription(id: string): Promise<Subscription | null>;
  forUser(userId: string): Promise<Subscription[]>;
  create(subscription: Subscription): Promise<Subscription>;
  cancellationRequested(id: string, at: string): Promise<void>;
  savePresets(id: string, presets: PreferencePreset[]): Promise<void>;
  remember(record: WebhookRecord): Promise<WebhookRecord>;
  applySubscription(subscription: Subscription, event: BillingEvent): Promise<void>;
  applyPayment(payment: Payment): Promise<void>;
  complete(id: string): Promise<void>;
  pending(): Promise<WebhookRecord[]>;
  expire(now: string): Promise<void>;
  listSubscriptions(offset: number): Promise<Subscription[]>;
  listPayments(offset: number): Promise<Payment[]>;
}
export class BillingError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}
export const presetSchema = z
  .object({
    name: z.string().trim().min(1).max(40),
    language: z.string().regex(/^(any|[a-z]{2})$/),
    interests: z
      .array(
        z
          .string()
          .trim()
          .toLowerCase()
          .min(2)
          .max(24)
          .regex(/^[\p{L}\p{N}][\p{L}\p{N} -]*$/u),
      )
      .max(10),
  })
  .strict();
