import { createHmac, randomUUID } from "node:crypto";
import { MongoClient, type Db } from "mongodb";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, inject, it } from "vitest";
import { MongoBillingStore } from "../../src/infrastructure/billing/mongo-billing-store.js";
import { BillingService } from "../../src/application/features/billing/billing-service.js";
import {
  MockPaymentProvider,
  UnavailablePaymentProvider,
} from "../../src/infrastructure/billing/payment-providers.js";
import type { BillingEvent } from "../../src/application/features/billing/contracts.js";
import { MvpInsights } from "../../src/infrastructure/admin/mvp-insights.js";
import { HmacKeyedHasher } from "../../src/infrastructure/identity/crypto.js";
import {
  MongoAgeVerificationStore,
  unavailableAgeProvider,
} from "../../src/infrastructure/identity/mongo-age-verification.js";
import { AgeAssurance } from "../../src/application/features/identity/age-assurance.js";
import { MongoAuditLog } from "../../src/infrastructure/moderation/mongo-audit-log.js";
import { createApp } from "../../src/api/app.js";
import { createMvpRouter, registerMvpOpenApi } from "../../src/api/features/site/mvp-router.js";
import {
  createBillingRouter,
  registerBillingOpenApi,
} from "../../src/api/features/billing/billing-router.js";
import { authenticate } from "../../src/api/auth/authentication.js";
import { createTestIdentity } from "../support/identity-fakes.js";
import type { Principal } from "../../src/application/features/identity/ports.js";
import { silentLogger } from "./support.js";
import { applyMongoIndexes } from "../../src/infrastructure/persistence/mongo/mongo-indexes.js";

const SECRET = "test-mock-signature-secret-0123456789";
const unlimited = { consume: () => Promise.resolve({ allowed: true, remaining: 10, retryAfterMs: 0 }) };
let now = new Date("2026-10-28T00:00:00.000Z");
let db: Db, store: MongoBillingStore, service: BillingService, insights: MvpInsights;
let mongo: MongoClient;
beforeAll(async () => {
  mongo = new MongoClient(inject("mongoUri"));
  await mongo.connect();
});
afterAll(async () => {
  await mongo.close();
});
beforeEach(async () => {
  now = new Date("2026-10-28T00:00:00.000Z");
  db = mongo.db(`parley_mvp_test_${randomUUID().replaceAll("-", "")}`);
  store = new MongoBillingStore(db);
  await store.initialize();
  service = new BillingService(
    store,
    new MockPaymentProvider("test", SECRET),
    false,
    "http://localhost/subscription",
    () => now,
  );
  insights = new MvpInsights(db, new HmacKeyedHasher("test-metrics-key-0123456789"), () => now);
  await insights.initialize();
});
async function pending(user = "owner") {
  await service.checkout(user, randomUUID());
  return (await store.forUser(user))[0]!;
}
function event(id: string, sequence = 1, overrides: Partial<BillingEvent> = {}): BillingEvent {
  return {
    id: `event-${sequence}`,
    subscriptionId: id,
    providerSubscriptionId: "provider-sub",
    sequence,
    occurredAt: now.toISOString(),
    kind: "activated",
    subscription: {
      status: "active",
      currentPeriodStart: "2026-10-28T00:00:00.000Z",
      currentPeriodEnd: "2026-11-28T00:00:00.000Z",
      cancelAtPeriodEnd: false,
    },
    payment: { id: "payment-1", amountMinor: 999, refundedMinor: 0, currency: "USD", status: "paid" },
    ...overrides,
  };
}
async function deliver(value: BillingEvent) {
  const raw = Buffer.from(JSON.stringify(value));
  await service.webhook(raw, {
    "x-parley-signature": createHmac("sha256", SECRET).update(raw).digest("hex"),
  });
}

describe("billing foundation stays isolated from the free MVP", () => {
  it("keeps checkout disabled with no provider and requires no merchant credentials", async () => {
    const disabled = new BillingService(store, new UnavailablePaymentProvider(), true, "http://localhost");
    await expect(disabled.checkout("owner", randomUUID())).rejects.toMatchObject({ status: 503 });
    expect((await disabled.overview("owner")).plus).toBe(false);
  });
  it("deduplicates concurrent verified events and does not activate from a checkout return", async () => {
    const sub = await pending();
    expect((await service.overview("owner")).plus).toBe(false);
    await Promise.all([deliver(event(sub.id)), deliver(event(sub.id))]);
    expect((await service.overview("owner")).plus).toBe(true);
    expect(await db.collection("payments").countDocuments()).toBe(1);
    expect(await db.collection("processed_webhook_events").countDocuments({ completed: true })).toBe(1);
  });
  it("reconciles an accepted inbox event after a crash between projection and completion", async () => {
    const sub = await pending();
    const complete = store.complete.bind(store);
    let first = true;
    store.complete = async (id: string) => {
      if (first) {
        first = false;
        throw new Error("crash after projection");
      }
      await complete(id);
    };
    await expect(deliver(event(sub.id))).rejects.toThrow("crash after projection");
    expect(await db.collection("processed_webhook_events").countDocuments({ completed: false })).toBe(1);
    await service.reconcile();
    expect(await db.collection("processed_webhook_events").countDocuments({ completed: true })).toBe(1);
    expect(await db.collection("payments").countDocuments()).toBe(1);
  });

  it("rejects bad signatures, cross-owner cancellation and paid presets for free accounts", async () => {
    const sub = await pending();
    await expect(service.webhook(Buffer.from("{}"), {})).rejects.toMatchObject({ status: 400 });
    await expect(service.cancel("another-user", sub.id)).rejects.toMatchObject({ status: 404 });
    await expect(service.savePresets("owner", [])).rejects.toMatchObject({ status: 403 });
  });
  it("uses agreed price after admin updates and rejects amount mismatches", async () => {
    const key = randomUUID();
    await service.checkout("owner", key);
    await store.savePlan(1499);
    await service.checkout("owner", key);
    const sub = (await store.forUser("owner"))[0]!;
    expect(sub.amountMinor).toBe(999);
    await expect(
      deliver(
        event(sub.id, 1, {
          payment: { id: "p", amountMinor: 1499, refundedMinor: 0, currency: "USD", status: "paid" },
        }),
      ),
    ).rejects.toMatchObject({ status: 400 });
    expect(await db.collection("processed_webhook_events").countDocuments()).toBe(0);
  });
  it("handles renewal, stale replay, cancellation, payment failure, refund and expiry", async () => {
    const sub = await pending();
    await deliver(event(sub.id));
    await service.savePresets("owner", [{ name: "English", language: "en", interests: ["music"] }]);
    await deliver(
      event(sub.id, 2, {
        kind: "renewed",
        payment: { id: "payment-2", amountMinor: 999, refundedMinor: 0, currency: "USD", status: "paid" },
        subscription: {
          status: "active",
          currentPeriodStart: "2026-10-28T00:00:00.000Z",
          currentPeriodEnd: "2026-12-28T00:00:00.000Z",
          cancelAtPeriodEnd: false,
        },
      }),
    );
    await deliver(event(sub.id));
    expect((await store.subscription(sub.id))?.revision).toBe(2);
    await service.cancel("owner", sub.id);
    expect((await store.subscription(sub.id))?.cancelRequestedAt).not.toBeNull();
    await deliver(
      event(sub.id, 3, {
        kind: "cancelled",
        payment: null,
        subscription: {
          status: "cancelled",
          currentPeriodStart: "2026-10-28T00:00:00.000Z",
          currentPeriodEnd: "2026-12-28T00:00:00.000Z",
          cancelAtPeriodEnd: true,
        },
      }),
    );
    expect((await service.overview("owner")).plus).toBe(true);
    await deliver(
      event(sub.id, 4, {
        kind: "payment_failed",
        payment: { id: "payment-3", amountMinor: 999, refundedMinor: 0, currency: "USD", status: "failed" },
        subscription: {
          status: "past_due",
          currentPeriodStart: "2026-10-28T00:00:00.000Z",
          currentPeriodEnd: "2026-12-28T00:00:00.000Z",
          cancelAtPeriodEnd: false,
        },
      }),
    );
    expect((await service.overview("owner")).plus).toBe(false);
    await deliver(
      event(sub.id, 5, {
        kind: "refunded",
        payment: {
          id: "payment-2",
          amountMinor: 999,
          refundedMinor: 999,
          currency: "USD",
          status: "refunded",
        },
        subscription: {
          status: "refunded",
          currentPeriodStart: "2026-10-28T00:00:00.000Z",
          currentPeriodEnd: "2026-12-28T00:00:00.000Z",
          cancelAtPeriodEnd: false,
        },
      }),
    );
    expect((await service.overview("owner")).plus).toBe(false);
    now = new Date("2027-01-01");
    expect((await service.overview("owner")).plus).toBe(false);
  });
});

describe("private waitlist, first-party metrics and age gating", () => {
  it("rejects index drift instead of accepting traffic without required uniqueness", async () => {
    await db.collection("index_probe").createIndex({ email: 1 }, { name: "required_email", unique: false });
    await expect(
      applyMongoIndexes(
        db,
        [
          {
            collection: "index_probe",
            indexes: [{ key: { email: 1 }, name: "required_email", unique: true }],
          },
        ],
        silentLogger,
      ),
    ).rejects.toThrow();
    const indexes = await db.collection("premium_waitlist").listIndexes().toArray();
    expect(indexes.find((index) => index.name === "retention_ttl")?.expireAfterSeconds).toBe(0);
  });
  it("deduplicates signups, supports immediate opt-out and enforces expiry before TTL cleanup", async () => {
    await insights.preview("owner");
    await insights.join("owner");
    await insights.join("owner");
    expect(await insights.joined("owner")).toBe(true);
    const summary = await insights.summary();
    expect(summary.waitlistSignups).toBe(1);
    expect(summary.waitlistConversion).toBe(1);
    const row = await db.collection("premium_waitlist").findOne();
    expect(row).not.toHaveProperty("email");
    expect(row).not.toHaveProperty("cardNumber");
    await insights.leave("owner");
    expect(await insights.joined("owner")).toBe(false);
    await insights.join("owner");
    now = new Date(now.getTime() + 91 * 86_400_000);
    expect(await insights.joined("owner")).toBe(false);
    expect((await insights.summary()).waitlistSignups).toBe(0);
  });
  it("deduplicates daily visitors and sessions, measures returns and sampled p95 without content", async () => {
    await insights.activity("visitor");
    await insights.activity("visitor");
    await insights.attempt();
    await insights.matched(1000);
    await insights.matched(5000);
    await insights.sessionEnded("session", new Date(now.getTime() - 60_000));
    await insights.sessionEnded("session", new Date(now.getTime() - 60_000));
    await insights.rtc("session", "visitor", "failed");
    await insights.rtc("session", "visitor", "failed");
    expect(await insights.summary()).toMatchObject({
      activeToday: 1,
      repeatVisitors: 0,
      matchAttempts: 1,
      successfulMatches: 2,
      averageWaitMs: 3000,
      sampledP95WaitMs: 5000,
      endedSessions: 1,
      rtcFailureRate: 1,
    });
    now = new Date(now.getTime() + 86_400_000);
    await insights.activity("visitor");
    expect((await insights.summary()).repeatVisitors).toBe(1);
  });
  it("keeps Adult disabled even when a persisted row claims verification but no provider is configured", async () => {
    const ages = new MongoAgeVerificationStore(db);
    await ages.initialize();
    const id = randomUUID();
    await ages.pending({
      userId: "owner",
      attemptId: id,
      provider: "none",
      status: "pending",
      expiresAt: null,
      updatedAt: now.toISOString(),
      revision: 0,
    });
    await ages.apply(
      "owner",
      { id: "e", attemptId: id, revision: 1, status: "verified", expiresAt: "2027-01-01T00:00:00Z" },
      now.toISOString(),
    );
    const age = new AgeAssurance(ages, unavailableAgeProvider, new MongoAuditLog(db), () => now);
    const principal: Principal = {
      kind: "user",
      subjectId: "owner",
      deviceId: "d",
      roles: [],
      emailVerified: true,
      mfa: false,
      termsVersion: "current",
    };
    expect(await age.isVerifiedAdult(principal)).toBe(false);
    expect((await age.status("owner")).configured).toBe(false);
  });
  it("enforces account ownership, explicit waitlist consent, staff MFA and raw webhook verification at the API", async () => {
    const identity = createTestIdentity();
    const principal: Principal = {
      kind: "user",
      subjectId: randomUUID(),
      deviceId: "d",
      roles: [],
      emailVerified: true,
      mfa: false,
      termsVersion: "current",
    };
    const token = (p: Principal) => identity.accessTokens.issue(p).then((v) => `Bearer ${v.token}`);
    const audit = new MongoAuditLog(db);
    const app = createApp({
      logger: silentLogger,
      corsAllowedOrigins: ["http://localhost"],
      healthChecks: [],
      enableApiReference: false,
      trustProxy: "loopback",
      authenticate: authenticate(identity.accessTokens),
      features: [
        { router: createMvpRouter(insights, unlimited), openApi: registerMvpOpenApi },
        { router: createBillingRouter(service, audit, unlimited), openApi: registerBillingOpenApi },
      ],
    });
    await request(app).post("/api/v1/premium/waitlist").send({ consent: true }).expect(401);
    await request(app)
      .post("/api/v1/premium/waitlist")
      .set("Authorization", await token({ ...principal, kind: "anonymous" }))
      .send({ consent: true })
      .expect(403);
    await request(app)
      .post("/api/v1/premium/waitlist")
      .set("Authorization", await token({ ...principal, emailVerified: false }))
      .send({ consent: true })
      .expect(403);
    const auth = await token(principal);
    await request(app).post("/api/v1/premium/waitlist").set("Authorization", auth).send({}).expect(400);
    await request(app)
      .post("/api/v1/premium/waitlist")
      .set("Authorization", auth)
      .send({ consent: true })
      .expect(200);
    await request(app).get("/api/v1/admin/product-metrics").set("Authorization", auth).expect(403);
    await request(app)
      .get("/api/v1/admin/product-metrics")
      .set("Authorization", await token({ ...principal, roles: ["Admin"] }))
      .expect(403);
    await request(app)
      .get("/api/v1/admin/product-metrics")
      .set("Authorization", await token({ ...principal, roles: ["Admin"], mfa: true }))
      .expect(200);
    await request(app)
      .put("/api/v1/billing/me/presets")
      .set("Authorization", auth)
      .send({ presets: [] })
      .expect(403);
    await request(app).post("/api/v1/billing/webhooks").send({}).expect(400);
    const sub = await pending(principal.subjectId);
    const payload = JSON.stringify(event(sub.id));
    await request(app)
      .post("/api/v1/billing/webhooks")
      .set("Content-Type", "application/json")
      .set("x-parley-signature", createHmac("sha256", SECRET).update(payload).digest("hex"))
      .send(payload)
      .expect(204);
    await request(app).delete("/api/v1/premium/waitlist").set("Authorization", auth).expect(204);
  });
});
