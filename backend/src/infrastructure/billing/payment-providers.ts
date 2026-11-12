import { createHmac, timingSafeEqual } from "node:crypto";
import type { PaymentProvider } from "../../application/features/billing/contracts.js";
import { BillingError } from "../../application/features/billing/contracts.js";

export class UnavailablePaymentProvider implements PaymentProvider {
  readonly id = "none";
  readonly checkoutEnabled = false;
  createCheckout(): Promise<{ url: string }> {
    return Promise.reject(
      new BillingError(503, "billing.unavailable", "No approved processor is configured."),
    );
  }
  cancelSubscription(): Promise<void> {
    return Promise.reject(new BillingError(503, "billing.unavailable", "No processor is configured."));
  }
  verifyWebhook(): Promise<unknown> {
    return Promise.reject(new Error("Billing unavailable"));
  }
}
/** Never instantiated in production. No confirmation route and no card form. Tests sign canonical events. */
export class MockPaymentProvider implements PaymentProvider {
  readonly id = "mock";
  readonly checkoutEnabled = true;
  constructor(
    private readonly environment: string,
    private readonly secret: string,
  ) {
    this.guard();
    if (secret.length < 32) throw new Error("Mock webhook secret must have at least 32 characters");
  }
  private guard(): void {
    if (!["development", "test"].includes(this.environment) || process.env.NODE_ENV === "production")
      throw new Error("Mock billing is forbidden in production");
  }
  createCheckout(input: Parameters<PaymentProvider["createCheckout"]>[0]): Promise<{ url: string }> {
    this.guard();
    const url = new URL(input.returnUrl);
    url.searchParams.set("mockCheckout", input.subscription.id);
    return Promise.resolve({ url: url.toString() });
  }
  cancelSubscription(): Promise<void> {
    this.guard();
    return Promise.resolve();
  }
  verifyWebhook(rawBody: Buffer, headers: Readonly<Record<string, string | undefined>>): Promise<unknown> {
    this.guard();
    const signature = headers["x-parley-signature"] ?? "";
    const expected = createHmac("sha256", this.secret).update(rawBody).digest("hex");
    if (
      !/^[a-f0-9]{64}$/.test(signature) ||
      !timingSafeEqual(Buffer.from(signature, "hex"), Buffer.from(expected, "hex"))
    )
      return Promise.reject(new Error("Invalid signature"));
    const parsed: unknown = JSON.parse(rawBody.toString("utf8"));
    return Promise.resolve(parsed);
  }
}
