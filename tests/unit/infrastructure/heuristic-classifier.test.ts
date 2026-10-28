import jpeg from "jpeg-js";
import { describe, expect, it } from "vitest";
import { DEFAULT_TEXT_RULES } from "../../../src/domain/moderation/text-rules.js";
import {
  HeuristicContentClassifier,
  skinScore,
} from "../../../src/infrastructure/moderation/heuristic-classifier.js";

/** A solid-colour JPEG. */
function solid(r: number, g: number, b: number): Buffer {
  const width = 32;
  const height = 24;
  const data = Buffer.alloc(width * height * 4);
  for (let offset = 0; offset < data.length; offset += 4) {
    data[offset] = r;
    data[offset + 1] = g;
    data[offset + 2] = b;
    data[offset + 3] = 255;
  }
  return jpeg.encode({ data, width, height }, 90).data;
}

const rules = { current: () => Promise.resolve(DEFAULT_TEXT_RULES) };

describe("HeuristicContentClassifier", () => {
  it("scores skin-toned images high and other images low", () => {
    expect(skinScore(solid(224, 172, 140))).toBe(1);
    expect(skinScore(solid(30, 90, 200))).toBe(0);
    expect(skinScore(Buffer.from("not a jpeg"))).toBeNull();
  });

  it("combines image and text signals into labelled scores", async () => {
    const classifier = new HeuristicContentClassifier(rules);

    const result = await classifier.classify({
      image: solid(224, 172, 140),
      texts: ["you fag", "add me on snap: cool_guy99", "hello"],
    });

    expect(result).toEqual({ image: 1, text: 0.65, labels: ["skin-exposure", "slur", "contact-info"] });
    expect(await classifier.classify({ image: null, texts: [] })).toEqual({
      image: null,
      text: null,
      labels: [],
    });
  });
});
