import jpeg from "jpeg-js";
import type { ContentClassifier, TextRulesProvider } from "../../application/features/moderation/ports.js";
import { moderateText } from "../../application/features/moderation/text-moderation.js";
import type { ReportScore } from "../../domain/moderation/report.js";

/** Snapshots are small (320 px); refuse anything that would decode to more than this. */
const MAX_MEGAPIXELS = 1;

/**
 * Free, dependency-light baseline classifier. Images: share of skin-tone pixels (YCbCr rule), a
 * coarse nudity signal that only orders the review queue, never acts on its own. Text: the text
 * rules (slurs, profanity, contact details). A model-based classifier can replace it behind
 * `ContentClassifier` without other changes (see ADR 0012).
 */
export class HeuristicContentClassifier implements ContentClassifier {
  constructor(private readonly rules: TextRulesProvider) {}

  async classify(input: {
    readonly image: Buffer | null;
    readonly texts: readonly string[];
  }): Promise<ReportScore> {
    const labels: string[] = [];
    const image = input.image ? skinScore(input.image) : null;
    if (image !== null && image >= 0.5) labels.push("skin-exposure");

    let text: number | null = null;
    if (input.texts.length > 0) {
      const rules = await this.rules.current();
      let blocked = 0;
      let masked = 0;
      let contact = 0;
      for (const message of input.texts) {
        const result = moderateText(message, rules, { strict: false });
        if (result.status === "blocked") blocked += 1;
        if (result.status === "ok" && result.masked) masked += 1;
        if (result.status === "ok" && result.removed.length > 0) contact += 1;
      }
      if (blocked > 0) labels.push("slur");
      if (masked > 0) labels.push("profanity");
      if (contact > 0) labels.push("contact-info");
      text = Math.min(1, blocked * 0.4 + masked * 0.15 + contact * 0.25);
    }
    return { image, text, labels };
  }
}

/** 0..1: how much of the image is skin-toned, scaled so 20% maps to 0 and 60% or more to 1. */
export function skinScore(bytes: Buffer): number | null {
  let decoded: { width: number; height: number; data: Uint8Array };
  try {
    decoded = jpeg.decode(bytes, { useTArray: true, maxResolutionInMP: MAX_MEGAPIXELS, formatAsRGBA: true });
  } catch {
    return null;
  }

  let skin = 0;
  const pixels = decoded.width * decoded.height;
  if (pixels === 0) return null;
  for (let offset = 0; offset < decoded.data.length; offset += 4) {
    const r = decoded.data[offset] ?? 0;
    const g = decoded.data[offset + 1] ?? 0;
    const b = decoded.data[offset + 2] ?? 0;
    const cb = 128 - 0.168736 * r - 0.331264 * g + 0.5 * b;
    const cr = 128 + 0.5 * r - 0.418688 * g - 0.081312 * b;
    if (cb >= 77 && cb <= 127 && cr >= 133 && cr <= 173) skin += 1;
  }
  const ratio = skin / pixels;
  return Math.round(Math.min(1, Math.max(0, (ratio - 0.2) / 0.4)) * 100) / 100;
}
