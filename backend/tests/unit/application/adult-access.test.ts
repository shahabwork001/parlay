import { describe, expect, it } from "vitest";
import { adultAdmission } from "../../../src/application/features/chat/adult-access.js";
import { joinQueueSchema } from "../../../src/application/features/chat/schemas.js";
import { matchmakingPool } from "../../../src/application/features/chat/chat-types.js";
import { moderateText } from "../../../src/application/features/moderation/text-moderation.js";
import { DEFAULT_TEXT_RULES } from "../../../src/domain/moderation/text-rules.js";
import type { Principal } from "../../../src/application/features/identity/ports.js";

const user: Principal = {
  kind: "user",
  subjectId: "a",
  deviceId: "d",
  roles: ["SuperAdmin"],
  emailVerified: true,
  mfa: true,
  termsVersion: "current",
};

describe("adult interaction admission", () => {
  it("defaults legacy requests to General without assuming consent", () => {
    const request = joinQueueSchema.parse({ mode: "video", interests: [], language: "any" });
    expect(request.interaction).toBe("general");
    expect(request.adultConsent).toBe(false);
    expect(joinQueueSchema.safeParse({ ...request, interaction: "anything" }).success).toBe(false);
  });
  it("requires fresh explicit consent even for verified staff", async () => {
    expect((await adultAdmission(user, false, { isVerifiedAdult: () => Promise.resolve(true) }))?.code).toBe(
      "adult.consent_required",
    );
  });
  it("fails closed without a provider, regardless of self-attestation or staff role", async () => {
    expect((await adultAdmission(user, true))?.code).toBe("adult.verification_required");
  });
  it("refuses anonymous access even if an adapter returns true", async () => {
    expect(
      (
        await adultAdmission({ ...user, kind: "anonymous" }, true, {
          isVerifiedAdult: () => Promise.resolve(true),
        })
      )?.code,
    ).toBe("adult.verification_required");
  });
  it("allows only current verified accounts with consent and propagates provider failures", async () => {
    expect(await adultAdmission(user, true, { isVerifiedAdult: () => Promise.resolve(true) })).toBeNull();
    expect((await adultAdmission(user, true, { isVerifiedAdult: () => Promise.resolve(false) }))?.code).toBe(
      "adult.verification_required",
    );
    await expect(
      adultAdmission(user, true, { isVerifiedAdult: () => Promise.reject(new Error("offline")) }),
    ).rejects.toThrow("offline");
  });
  it("preserves legacy General keys and isolates Adult at every trust tier", () => {
    for (const pool of ["standard", "low-trust", "shadow"] as const) {
      expect(matchmakingPool(pool)).toBe(pool);
      expect(matchmakingPool(pool, "adult")).toBe(`adult-${pool}`);
    }
  });
  it("permits adult vocabulary while preserving blocked words and contact protection", () => {
    const rules = { ...DEFAULT_TEXT_RULES, maskedWords: ["explicit"], blockedWords: ["threat"] };
    expect(moderateText("explicit", rules, { strict: false }).status).toBe("ok");
    expect(moderateText("explicit", rules, { strict: true, adult: true })).toMatchObject({
      text: "explicit",
      masked: false,
    });
    expect(moderateText("threat", rules, { strict: false, adult: true }).status).toBe("blocked");
    expect(moderateText("www.example.com", rules, { strict: false, adult: true })).toMatchObject({
      removed: ["link"],
    });
  });
});
