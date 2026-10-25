import { describe, expect, it } from "vitest";
import { classifyMediaError } from "@/services/media/media-devices";
import { classifyQuality, sampleStats, toQuality } from "./connection-quality";

describe("classifyQuality", () => {
  it.each([
    [80, 0.01, "good"],
    [200, 0.01, "fair"],
    [80, 0.05, "fair"],
    [500, 0, "poor"],
    [100, 0.12, "poor"],
    [null, null, "unknown"],
  ] as const)("rtt %s ms and loss %s is %s", (rtt, loss, level) => {
    expect(classifyQuality(rtt, loss)).toBe(level);
  });
});

describe("toQuality", () => {
  it("measures loss between consecutive samples", () => {
    const first = { roundTripMs: 40, packetsLost: 10, packetsReceived: 1000, relayed: false };
    const second = { roundTripMs: 40, packetsLost: 20, packetsReceived: 1090, relayed: true };

    const quality = toQuality(first, second);

    expect(quality.packetLoss).toBeCloseTo(0.1);
    expect(quality.level).toBe("poor");
    expect(quality.relayed).toBe(true);
  });

  it("reports unknown loss when no packets arrived", () => {
    const sample = { roundTripMs: null, packetsLost: 0, packetsReceived: 0, relayed: false };
    expect(toQuality(null, sample)).toMatchObject({ level: "unknown", packetLoss: null });
  });
});

describe("sampleStats", () => {
  it("reads the selected candidate pair, inbound RTP totals and relay usage", () => {
    const entries = [
      { id: "T1", type: "transport", selectedCandidatePairId: "CP1" },
      { id: "CP1", type: "candidate-pair", currentRoundTripTime: 0.123, localCandidateId: "L1" },
      { id: "L1", type: "local-candidate", candidateType: "relay" },
      { id: "IA", type: "inbound-rtp", kind: "audio", packetsLost: 2, packetsReceived: 500 },
      { id: "IV", type: "inbound-rtp", kind: "video", packetsLost: 3, packetsReceived: 1500 },
    ];
    const report = new Map(entries.map((entry) => [entry.id, entry])) as unknown as RTCStatsReport;

    expect(sampleStats(report)).toEqual({
      roundTripMs: 123,
      packetsLost: 5,
      packetsReceived: 2000,
      relayed: true,
    });
  });
});

describe("classifyMediaError", () => {
  it.each([
    ["NotAllowedError", "denied"],
    ["NotFoundError", "not-found"],
    ["NotReadableError", "in-use"],
    ["SomethingElse", "unknown"],
  ] as const)("%s means %s", (name, kind) => {
    expect(classifyMediaError(new DOMException("x", name))).toBe(kind);
  });

  it("treats non-DOM errors as unknown", () => {
    expect(classifyMediaError(new Error("boom"))).toBe("unknown");
  });
});
