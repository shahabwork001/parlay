import { z } from "zod";
import { httpClient, type HttpClient } from "@/lib/http";
const preset = z.object({ name: z.string(), language: z.string(), interests: z.array(z.string()) });
const subscription = z.object({
  id: z.string(),
  planId: z.string(),
  status: z.enum(["pending", "active", "past_due", "cancelled", "expired", "refunded"]),
  amountMinor: z.number(),
  currency: z.literal("USD"),
  currentPeriodEnd: z.string().nullable(),
  cancelAtPeriodEnd: z.boolean(),
  cancelRequestedAt: z.string().nullable(),
  presets: z.array(preset),
});
const plan = z.object({
  id: z.string(),
  name: z.string(),
  amountMinor: z.number(),
  currency: z.literal("USD"),
  interval: z.literal("month"),
  entitlements: z.array(z.string()),
});
const availability = { checkoutEnabled: z.boolean(), mock: z.boolean() };
export type Preset = z.infer<typeof preset>;
export const billingKeys = { me: ["billing", "me"] as const, plans: ["billing", "plans"] as const };
export class BillingRepository {
  constructor(private readonly client: HttpClient) {}
  plans() {
    return this.client.request("/api/v1/billing/plans", {
      schema: z.object({ plan, ...availability }),
    });
  }
  me() {
    return this.client.request("/api/v1/billing/me", {
      schema: z.object({
        subscription: subscription.nullable(),
        plus: z.boolean(),
        ...availability,
      }),
    });
  }
  checkout(key: string) {
    return this.client.request("/api/v1/billing/me/checkout", {
      method: "POST",
      headers: { "Idempotency-Key": key },
      schema: z.object({ url: z.httpUrl() }),
    });
  }
  cancel(id: string) {
    return this.client.request(`/api/v1/billing/me/${encodeURIComponent(id)}/cancel`, {
      method: "POST",
      schema: z.undefined(),
    });
  }
  savePresets(presets: Preset[]) {
    return this.client.request("/api/v1/billing/me/presets", {
      method: "PUT",
      body: { presets },
      schema: z.undefined(),
    });
  }
  admin(offset: number) {
    return this.client.request(`/api/v1/admin/billing?offset=${offset}`, {
      schema: z.object({
        subscriptions: z.array(subscription.extend({ userId: z.string(), provider: z.string() })),
        payments: z.array(
          z.object({
            id: z.string(),
            userId: z.string(),
            subscriptionId: z.string(),
            amountMinor: z.number(),
            refundedMinor: z.number(),
            currency: z.literal("USD"),
            status: z.string(),
            occurredAt: z.string(),
          }),
        ),
        offset: z.number(),
        pageSize: z.number(),
      }),
    });
  }
  price(amountMinor: number) {
    return this.client.request("/api/v1/admin/billing/plan", {
      method: "PUT",
      body: { amountMinor },
      schema: z.object({ amountMinor: z.number() }),
    });
  }
}
export const billingRepository = new BillingRepository(httpClient);
