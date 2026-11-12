import type { ScreeningRequest, ScreeningResponse } from "./screening-messages";
import { nsfwScore, ScreeningTracker } from "./screening-policy";

const SAMPLE_INTERVAL_MS = 3000;
/** After this many consecutive worker failures screening stops (the model could not load). */
const MAX_FAILURES = 3;

export const isScreeningSupported = (): boolean =>
  typeof window !== "undefined" &&
  typeof Worker !== "undefined" &&
  typeof OffscreenCanvas !== "undefined" &&
  typeof createImageBitmap === "function";

export interface ScreenerCallbacks {
  /** Called when the decision changes; `score` is the frame that tipped it. */
  onChange(flagged: boolean, score: number): void;
  /** Screening could not run (unsupported browser or model failure). */
  onUnavailable?(): void;
}

/**
 * Samples the person's own camera every few seconds and classifies the frame in a Web Worker.
 * Frames never leave the device; only the decision (and its score) is reported.
 */
export class ContentScreener {
  readonly #tracker: ScreeningTracker;
  readonly #video = document.createElement("video");
  #worker: Worker | null = null;
  #timer = 0;
  #busy = false;
  #failures = 0;
  #nextId = 0;

  constructor(
    threshold: number,
    private readonly callbacks: ScreenerCallbacks,
  ) {
    this.#tracker = new ScreeningTracker(threshold);
    this.#video.muted = true;
    this.#video.playsInline = true;
  }

  start(stream: MediaStream): void {
    this.stop();
    if (!isScreeningSupported()) {
      this.callbacks.onUnavailable?.();
      return;
    }
    this.#worker = new Worker(new URL("./nsfw.worker.ts", import.meta.url), { type: "module" });
    this.#worker.onmessage = (event: MessageEvent<ScreeningResponse>) => this.receive(event.data);
    this.#video.srcObject = stream;
    void this.#video.play().catch(() => undefined);
    this.#timer = window.setInterval(() => void this.sample(), SAMPLE_INTERVAL_MS);
  }

  get flagged(): boolean {
    return this.#tracker.flagged;
  }

  setThreshold(threshold: number): void {
    this.#tracker.setThreshold(threshold);
  }

  stop(): void {
    window.clearInterval(this.#timer);
    this.#worker?.terminate();
    this.#worker = null;
    this.#busy = false;
    this.#video.pause();
    this.#video.srcObject = null;
  }

  private async sample(): Promise<void> {
    const worker = this.#worker;
    if (!worker || this.#busy || this.#video.videoWidth === 0) return;
    this.#busy = true;
    try {
      const frame = await createImageBitmap(this.#video);
      const request: ScreeningRequest = { id: (this.#nextId += 1), frame };
      worker.postMessage(request, [frame]);
    } catch {
      this.#busy = false;
    }
  }

  private receive(response: ScreeningResponse): void {
    this.#busy = false;
    if ("error" in response) {
      this.#failures += 1;
      if (this.#failures >= MAX_FAILURES) {
        this.stop();
        this.callbacks.onUnavailable?.();
      }
      return;
    }
    this.#failures = 0;
    const score = nsfwScore(response.predictions);
    const change = this.#tracker.observe(score);
    if (change) this.callbacks.onChange(change === "flagged", score);
  }
}

/**
 * A blurred copy of a video track, drawn through a canvas. Sent to the partner in place of the
 * camera while screening flags the picture.
 */
export function createBlurredTrack(
  source: MediaStream,
): { track: MediaStreamTrack; stop(): void } | null {
  const settings = source.getVideoTracks()[0]?.getSettings();
  const canvas = document.createElement("canvas");
  canvas.width = settings?.width ?? 640;
  canvas.height = settings?.height ?? 480;
  const context = canvas.getContext("2d");
  if (!context || typeof canvas.captureStream !== "function") return null;

  const video = document.createElement("video");
  video.muted = true;
  video.playsInline = true;
  video.srcObject = source;
  void video.play().catch(() => undefined);

  // A timer, not requestAnimationFrame, so the blur keeps running in a background tab.
  const timer = window.setInterval(() => {
    context.filter = "blur(32px)";
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
  }, 1000 / 15);
  const [track] = canvas.captureStream(15).getVideoTracks();
  if (!track) {
    window.clearInterval(timer);
    return null;
  }
  return {
    track,
    stop() {
      window.clearInterval(timer);
      track.stop();
      video.pause();
      video.srcObject = null;
    },
  };
}
