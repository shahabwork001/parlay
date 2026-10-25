export type QualityLevel = "good" | "fair" | "poor" | "unknown";

export interface ConnectionQuality {
  readonly level: QualityLevel;
  /** Round-trip time in milliseconds on the selected candidate pair. */
  readonly roundTripMs: number | null;
  /** Share of inbound packets lost since the previous sample (0-1). */
  readonly packetLoss: number | null;
  /** True when media flows through the TURN relay. */
  readonly relayed: boolean;
}

export interface QualitySample {
  readonly roundTripMs: number | null;
  readonly packetsLost: number;
  readonly packetsReceived: number;
  readonly relayed: boolean;
}

export const UNKNOWN_QUALITY: ConnectionQuality = {
  level: "unknown",
  roundTripMs: null,
  packetLoss: null,
  relayed: false,
};

/** Thresholds follow common VoIP guidance: under 150 ms and 2% loss feels instant; over 400 ms or 8% does not. */
export function classifyQuality(
  roundTripMs: number | null,
  packetLoss: number | null,
): QualityLevel {
  if (roundTripMs === null && packetLoss === null) return "unknown";
  const rtt = roundTripMs ?? 0;
  const loss = packetLoss ?? 0;
  if (rtt < 150 && loss < 0.02) return "good";
  if (rtt < 400 && loss < 0.08) return "fair";
  return "poor";
}

/** Turns two consecutive stats samples into a quality reading (loss is measured between them). */
export function toQuality(
  previous: QualitySample | null,
  current: QualitySample,
): ConnectionQuality {
  const lost = current.packetsLost - (previous?.packetsLost ?? 0);
  const received = current.packetsReceived - (previous?.packetsReceived ?? 0);
  const packetLoss = lost + received > 0 ? Math.max(lost, 0) / (lost + received) : null;
  return {
    level: classifyQuality(current.roundTripMs, packetLoss),
    roundTripMs: current.roundTripMs,
    packetLoss,
    relayed: current.relayed,
  };
}

/** Extracts the numbers we need from RTCStatsReport (selected pair, inbound RTP, local candidate type). */
export function sampleStats(report: RTCStatsReport): QualitySample {
  let roundTripMs: number | null = null;
  let relayed = false;
  let packetsLost = 0;
  let packetsReceived = 0;
  let selectedPairId: string | undefined;
  const byId = new Map<string, Record<string, unknown>>();

  report.forEach((stat: Record<string, unknown>) => {
    byId.set(String(stat.id), stat);
    if (stat.type === "transport" && typeof stat.selectedCandidatePairId === "string") {
      selectedPairId = stat.selectedCandidatePairId;
    }
    if (stat.type === "inbound-rtp") {
      packetsLost += typeof stat.packetsLost === "number" ? stat.packetsLost : 0;
      packetsReceived += typeof stat.packetsReceived === "number" ? stat.packetsReceived : 0;
    }
  });

  const pair =
    (selectedPairId ? byId.get(selectedPairId) : undefined) ??
    [...byId.values()].find(
      (stat) =>
        stat.type === "candidate-pair" && stat.nominated === true && stat.state === "succeeded",
    );
  if (pair) {
    if (typeof pair.currentRoundTripTime === "number")
      roundTripMs = Math.round(pair.currentRoundTripTime * 1000);
    const local = byId.get(String(pair.localCandidateId));
    relayed = local?.candidateType === "relay";
  }

  return { roundTripMs, packetsLost, packetsReceived, relayed };
}
