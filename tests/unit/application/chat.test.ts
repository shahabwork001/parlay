import { describe, expect, it } from "vitest";
import { partnerOf } from "../../../src/application/features/chat/chat-types.js";
import { joinQueueSchema } from "../../../src/application/features/chat/schemas.js";
import { TokenBucket } from "../../../src/api/realtime/token-bucket.js";

describe("joinQueueSchema", () => {
  it("normalises and de-duplicates interests", () => {
    const parsed = joinQueueSchema.parse({
      mode: "text",
      language: "en",
      interests: ["Music", " music ", "chess"],
    });
    expect(parsed.interests).toEqual(["music", "chess"]);
  });

  it("rejects unknown modes, bad languages and too many interests", () => {
    expect(joinQueueSchema.safeParse({ mode: "audio", language: "en", interests: [] }).success).toBe(false);
    expect(joinQueueSchema.safeParse({ mode: "text", language: "english", interests: [] }).success).toBe(
      false,
    );
    expect(
      joinQueueSchema.safeParse({
        mode: "text",
        language: "any",
        interests: Array.from({ length: 11 }, (_, i) => `tag${i}`),
      }).success,
    ).toBe(false);
  });
});

describe("partnerOf", () => {
  it("returns the other participant", () => {
    const session = {
      sessionId: "s",
      mode: "text" as const,
      caller: {
        subjectId: "a",
        deviceId: "da",
        kind: "anonymous" as const,
        networkHash: "n",
        subnetHash: "s",
      },
      callee: { subjectId: "b", deviceId: "db", kind: "user" as const, networkHash: "n", subnetHash: "s" },
      sharedInterests: [],
      startedAt: new Date(),
    };
    expect(partnerOf(session, "a").subjectId).toBe("b");
    expect(partnerOf(session, "b").subjectId).toBe("a");
  });
});

describe("TokenBucket", () => {
  it("allows a burst up to capacity, then refills over time", () => {
    let now = 0;
    const bucket = new TokenBucket(3, 1, () => now);

    expect([bucket.tryTake(), bucket.tryTake(), bucket.tryTake(), bucket.tryTake()]).toEqual([
      true,
      true,
      true,
      false,
    ]);
    now = 1000;
    expect(bucket.tryTake()).toBe(true);
    expect(bucket.tryTake()).toBe(false);
  });
});
