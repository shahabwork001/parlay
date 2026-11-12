import { describe, expect, it } from "vitest";
import { nsfwScore, ScreeningTracker } from "./screening-policy";

const frame = (porn: number, sexy = 0, hentai = 0) => [
  { className: "Porn", probability: porn },
  { className: "Sexy", probability: sexy },
  { className: "Hentai", probability: hentai },
  { className: "Neutral", probability: 1 - porn - sexy - hentai },
];

describe("nsfwScore", () => {
  it("counts explicit classes fully and suggestive ones half", () => {
    expect(nsfwScore(frame(0.8))).toBeCloseTo(0.8);
    expect(nsfwScore(frame(0, 0.6))).toBeCloseTo(0.3);
    expect(nsfwScore(frame(0.1, 0.2, 0.6))).toBeCloseTo(0.7);
    expect(nsfwScore(frame(0.9, 0.5))).toBe(1);
    expect(nsfwScore([])).toBe(0);
  });
});

describe("ScreeningTracker", () => {
  it("flags after two frames over the threshold and clears after three clean ones", () => {
    const tracker = new ScreeningTracker(0.7);
    expect([0.9, 0.2, 0.9, 0.95].map((score) => tracker.observe(score))).toEqual([
      null,
      null,
      null,
      "flagged",
    ]);
    expect(tracker.flagged).toBe(true);
    expect([0.1, 0.1, 0.8, 0.1, 0.1, 0.1].map((score) => tracker.observe(score))).toEqual([
      null,
      null,
      null,
      null,
      null,
      "cleared",
    ]);
    expect(tracker.flagged).toBe(false);
  });

  it("applies a stricter threshold from then on", () => {
    const tracker = new ScreeningTracker(0.75);
    tracker.setThreshold(0.5);
    tracker.observe(0.6);
    expect(tracker.observe(0.6)).toBe("flagged");
  });
});
