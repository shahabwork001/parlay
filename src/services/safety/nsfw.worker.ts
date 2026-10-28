/*
 * Classifies video frames off the main thread with NSFWJS (MobileNetV2, bundled with the app, so no
 * frame or model request ever leaves the device). Loaded only when a video chat starts.
 */
import * as tf from "@tensorflow/tfjs";
import { load, type NSFWJS } from "nsfwjs";
import type { ScreeningRequest, ScreeningResponse } from "./screening-messages";

const INPUT_SIZE = 224;

const scope = globalThis as unknown as {
  onmessage: ((event: MessageEvent<ScreeningRequest>) => void) | null;
  postMessage(message: ScreeningResponse): void;
};

let model: Promise<NSFWJS> | null = null;
const canvas = new OffscreenCanvas(INPUT_SIZE, INPUT_SIZE);
const context = canvas.getContext("2d", { willReadFrequently: true });

scope.onmessage = (event) => {
  const { id, frame } = event.data;
  void (async () => {
    try {
      model ??= tf.ready().then(() => load("MobileNetV2"));
      const classifier = await model;
      if (!context) throw new Error("2D canvas unavailable in worker");
      context.drawImage(frame, 0, 0, INPUT_SIZE, INPUT_SIZE);
      const pixels = tf.browser.fromPixels(context.getImageData(0, 0, INPUT_SIZE, INPUT_SIZE));
      const predictions = await classifier.classify(pixels);
      pixels.dispose();
      scope.postMessage({
        id,
        predictions: predictions.map(({ className, probability }) => ({ className, probability })),
      });
    } catch (error) {
      scope.postMessage({ id, error: error instanceof Error ? error.message : "Screening failed" });
    } finally {
      frame.close();
    }
  })();
};
