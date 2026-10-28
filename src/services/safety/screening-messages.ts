import type { Prediction } from "./screening-policy";

export interface ScreeningRequest {
  readonly id: number;
  readonly frame: ImageBitmap;
}

export type ScreeningResponse =
  | { readonly id: number; readonly predictions: readonly Prediction[] }
  | { readonly id: number; readonly error: string };
