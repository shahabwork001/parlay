import { z } from "zod";
import { randomUUID } from "node:crypto";
import type { AdultAccessPolicy } from "../chat/adult-access.js";
import type { Principal } from "./ports.js";
import type { AuditLog } from "../moderation/ports.js";
import { SYSTEM_ACTOR } from "../moderation/ports.js";

export interface AgeVerification {
  userId: string;
  attemptId: string;
  provider: string;
  status: "pending" | "verified" | "rejected" | "expired" | "revoked";
  expiresAt: string | null;
  updatedAt: string;
  revision: number;
}
export const ageResultSchema = z
  .object({
    id: z
      .string()
      .min(1)
      .max(200)
      .regex(/^[a-zA-Z0-9_.:-]+$/),
    attemptId: z.uuid(),
    revision: z.number().int().positive(),
    status: z.enum(["verified", "rejected", "expired", "revoked"]),
    expiresAt: z.iso.datetime().nullable(),
  })
  .strict()
  .refine(
    (result) => result.status !== "verified" || result.expiresAt !== null,
    "Verified age requires an expiry",
  );
export type AgeResult = z.infer<typeof ageResultSchema>;
export interface AgeVerificationProvider {
  readonly id: string;
  readonly available: boolean;
  start(input: { userId: string; attemptId: string }): Promise<{ url: string }>;
  verifyWebhook(raw: Buffer, headers: Readonly<Record<string, string | undefined>>): Promise<unknown>;
}
export interface AgeVerificationStore {
  current(userId: string): Promise<AgeVerification | null>;
  pending(record: AgeVerification): Promise<void>;
  forAttempt(attemptId: string): Promise<AgeVerification | null>;
  apply(userId: string, result: AgeResult, at: string): Promise<void>;
}
export class AgeAssurance implements AdultAccessPolicy {
  constructor(
    readonly store: AgeVerificationStore,
    readonly provider: AgeVerificationProvider,
    private readonly audit: AuditLog,
    private readonly now: () => Date = () => new Date(),
  ) {}
  async isVerifiedAdult(principal: Principal): Promise<boolean> {
    if (!this.provider.available || principal.kind !== "user") return false;
    const record = await this.store.current(principal.subjectId);
    return (
      record?.provider === this.provider.id &&
      record.status === "verified" &&
      record.expiresAt !== null &&
      Date.parse(record.expiresAt) > this.now().getTime()
    );
  }
  async status(userId: string) {
    const record = await this.store.current(userId);
    const status =
      record?.status === "verified" &&
      (!record.expiresAt || Date.parse(record.expiresAt) <= this.now().getTime())
        ? "expired"
        : (record?.status ?? "not_started");
    return { configured: this.provider.available, status, expiresAt: record?.expiresAt ?? null };
  }
  async start(userId: string): Promise<{ url: string }> {
    if (!this.provider.available) throw new Error("Age verification is not configured");
    const attemptId = randomUUID();
    await this.audit.record({
      id: `age-start:${attemptId}`,
      actor: SYSTEM_ACTOR,
      action: "age.verification_started",
      target: { type: "user", id: userId },
      at: this.now(),
    });
    await this.store.pending({
      userId,
      attemptId,
      provider: this.provider.id,
      status: "pending",
      expiresAt: null,
      updatedAt: this.now().toISOString(),
      revision: 0,
    });
    return this.provider.start({ userId, attemptId });
  }
  async webhook(raw: Buffer, headers: Readonly<Record<string, string | undefined>>): Promise<void> {
    if (!this.provider.available) throw new Error("Age verification is not configured");
    const result = ageResultSchema.parse(await this.provider.verifyWebhook(raw, headers));
    const record = await this.store.forAttempt(result.attemptId);
    if (!record || record.provider !== this.provider.id) throw new Error("Unknown age verification attempt");
    // Audit before changing access. A redelivery retries the status write without duplicating the audit.
    await this.audit.record({
      id: `age:${this.provider.id}:${result.id}`,
      actor: SYSTEM_ACTOR,
      action: `age.${result.status}`,
      target: { type: "user", id: record.userId },
      metadata: { revision: result.revision },
      at: this.now(),
    });
    await this.store.apply(record.userId, result, this.now().toISOString());
  }
}
