/** NSFWJS class names and probabilities for one frame. */
export interface Prediction {
  readonly className: string;
  readonly probability: number;
}

/** 0..1: explicit classes count fully, "Sexy" (suggestive) counts half. */
export function nsfwScore(predictions: readonly Prediction[]): number {
  const probability = (name: string) =>
    predictions.find((prediction) => prediction.className === name)?.probability ?? 0;
  return Math.min(
    1,
    Math.max(probability("Porn"), probability("Hentai")) + probability("Sexy") * 0.5,
  );
}

export type ScreeningChange = "flagged" | "cleared" | null;

/**
 * Turns per-frame scores into a stable decision: flagged after `flagAfter` consecutive frames at or
 * above the threshold, cleared after `clearAfter` consecutive frames below it. One borderline frame
 * never blurs the video, and one clean frame never unblurs it.
 */
export class ScreeningTracker {
  #flagged = false;
  #streak = 0;

  constructor(
    private threshold: number,
    private readonly flagAfter = 2,
    private readonly clearAfter = 3,
  ) {}

  get flagged(): boolean {
    return this.#flagged;
  }

  setThreshold(threshold: number): void {
    this.threshold = threshold;
  }

  observe(score: number): ScreeningChange {
    const over = score >= this.threshold;
    if (over === this.#flagged) {
      this.#streak = 0;
      return null;
    }
    this.#streak += 1;
    if (this.#streak < (this.#flagged ? this.clearAfter : this.flagAfter)) return null;
    this.#flagged = over;
    this.#streak = 0;
    return over ? "flagged" : "cleared";
  }
}
