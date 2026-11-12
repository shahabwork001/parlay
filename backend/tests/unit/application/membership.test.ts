import { describe, expect, it } from "vitest";
import { hasPlus, type Subscription } from "../../../src/domain/billing/membership.js";
import { billingEventSchema } from "../../../src/application/features/billing/contracts.js";
import {
  MockPaymentProvider,
  UnavailablePaymentProvider,
} from "../../../src/infrastructure/billing/payment-providers.js";
const subscription: Subscription = {
  id: "s",
  userId: "u",
  planId: "plus",
  provider: "mock",
  requestKey: "k",
  amountMinor: 999,
  currency: "USD",
  status: "active",
  revision: 1,
  providerSubscriptionId: "ps",
  currentPeriodStart: "2026-10-01T00:00:00.000Z",
  currentPeriodEnd: "2026-11-01T00:00:00.000Z",
  cancelAtPeriodEnd: false,
  cancelRequestedAt: null,
  createdAt: "2026-10-01T00:00:00.000Z",
  checkoutExpiresAt: "2026-10-01T01:00:00.000Z",
  presets: [],
};
describe("membership safety", () => {
  it("expires entitlements at the boundary without depending on a scheduled sweep", () => {
    expect(hasPlus(subscription, new Date("2026-10-28"), false)).toBe(true);
    expect(hasPlus(subscription, new Date("2026-11-01"), false)).toBe(false);
    expect(hasPlus({ ...subscription, status: "past_due" }, new Date("2026-10-28"), false)).toBe(false);
    expect(hasPlus({ ...subscription, status: "refunded" }, new Date("2026-10-28"), false)).toBe(false);
    expect(
      hasPlus(
        { ...subscription, status: "cancelled", cancelAtPeriodEnd: true },
        new Date("2026-10-28"),
        false,
      ),
    ).toBe(true);
  });
  it("never grants mock entitlements or starts mock billing in production", () => {
    expect(hasPlus(subscription, new Date("2026-10-28"), true)).toBe(false);
    expect(() => new MockPaymentProvider("production", "s".repeat(32))).toThrow("forbidden");
    expect(new UnavailablePaymentProvider().checkoutEnabled).toBe(false);
  });
  it("rejects unknown/card fields and unverifiable event shapes", () => {
    expect(billingEventSchema.safeParse({ cardNumber: "never-store-this" }).success).toBe(false);
  });
});
