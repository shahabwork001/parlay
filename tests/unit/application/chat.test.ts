import { describe, expect, it } from "vitest";
import { partnerOf } from "../../../src/application/features/chat/chat-types.js";
import { joinQueueSchema, MAX_MESSAGE_LENGTH } from "../../../src/application/features/chat/schemas.js";
import { filterChatText, LINK_PLACEHOLDER } from "../../../src/application/features/chat/text-filter.js";
import { TokenBucket } from "../../../src/api/realtime/token-bucket.js";

describe("filterChatText", () => {
  it("leaves clean text untouched apart from trimming", () => {
    expect(filterChatText("  hello there, how are you?  ")).toEqual({
      text: "hello there, how are you?",
      masked: false,
      linksRemoved: false,
    });
  });

  it("masks blocked words with bullets of the same length, case-insensitively", () => {
    const result = filterChatText("what the FUCK is this shit");
    expect(result.text).toBe("what the •••• is this ••••");
    expect(result.masked).toBe(true);
  });

  it("catches simple leetspeak and stretched letters", () => {
    expect(filterChatText("sh1t").text).toBe("••••");
    expect(filterChatText("fuuuuck").text).toBe("•••••••");
  });

  it("does not mask innocent words that contain a blocked word", () => {
    expect(filterChatText("Scunthorpe is a classic example").masked).toBe(false);
    expect(filterChatText("assessment").masked).toBe(false);
  });

  it("removes links by default", () => {
    for (const link of ["https://example.com/x", "www.example.org", "find me at my-site.io/profile"]) {
      const result = filterChatText(link);
      expect(result.text).toContain(LINK_PLACEHOLDER);
      expect(result.linksRemoved).toBe(true);
    }
  });

  it("caps the message length", () => {
    expect(filterChatText("a".repeat(MAX_MESSAGE_LENGTH + 50)).text).toHaveLength(MAX_MESSAGE_LENGTH);
  });

  it("accepts a custom word list", () => {
    expect(filterChatText("banana split", ["banana"]).text).toBe("•••••• split");
  });
});

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
      caller: { subjectId: "a", deviceId: "da" },
      callee: { subjectId: "b", deviceId: "db" },
      sharedInterests: [],
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
