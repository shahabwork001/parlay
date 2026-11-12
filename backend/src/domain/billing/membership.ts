export type SubscriptionStatus = "pending" | "active" | "past_due" | "cancelled" | "expired" | "refunded";
export interface Plan {
  id: string;
  name: string;
  amountMinor: number;
  currency: "USD";
  interval: "month";
  entitlements: readonly string[];
}
export interface PreferencePreset {
  name: string;
  language: string;
  interests: string[];
}
export interface Subscription {
  id: string;
  userId: string;
  planId: string;
  provider: string;
  requestKey: string;
  amountMinor: number;
  currency: "USD";
  status: SubscriptionStatus;
  revision: number;
  providerSubscriptionId: string | null;
  currentPeriodStart: string | null;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  cancelRequestedAt: string | null;
  createdAt: string;
  checkoutExpiresAt: string;
  presets: PreferencePreset[];
}
export interface Payment {
  id: string;
  subscriptionId: string;
  userId: string;
  provider: string;
  providerPaymentId: string;
  amountMinor: number;
  refundedMinor: number;
  currency: "USD";
  status: "paid" | "failed" | "partially_refunded" | "refunded";
  revision: number;
  occurredAt: string;
}
export function hasPlus(subscription: Subscription | null, now: Date, production: boolean): boolean {
  return (
    subscription !== null &&
    !(production && subscription.provider === "mock") &&
    (subscription.status === "active" || subscription.status === "cancelled") &&
    subscription.currentPeriodStart !== null &&
    Date.parse(subscription.currentPeriodStart) <= now.getTime() &&
    subscription.currentPeriodEnd !== null &&
    Date.parse(subscription.currentPeriodEnd) > now.getTime()
  );
}
