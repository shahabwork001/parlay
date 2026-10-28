import { z } from "zod";
import { REPORT_CATEGORIES } from "../../../domain/moderation/report.js";

/** A JPEG data URL; 96 KB of base64 is ample for the 320 px snapshot the client sends. */
export const MAX_SNAPSHOT_DATA_URL_LENGTH = 96_000;
const JPEG_DATA_URL = /^data:image\/jpeg;base64,[A-Za-z0-9+/]+={0,2}$/;

export const submitReportSchema = z
  .object({
    sessionId: z.uuid(),
    category: z.enum(REPORT_CATEGORIES),
    note: z.string().trim().max(500).optional(),
    snapshot: z
      .string()
      .max(MAX_SNAPSHOT_DATA_URL_LENGTH)
      .regex(JPEG_DATA_URL, "Must be a JPEG data URL.")
      .optional(),
  })
  .meta({ id: "SubmitReportRequest" });

export type SubmitReportRequest = z.infer<typeof submitReportSchema>;

export const appealSchema = z
  .object({ message: z.string().trim().min(20, "Tell us a bit more (at least 20 characters).").max(2000) })
  .meta({ id: "AppealRequest" });

export type AppealRequest = z.infer<typeof appealSchema>;

/** Socket payload: the client's own video was flagged by on-device screening. */
export const contentFlagSchema = z.object({
  source: z.literal("nsfw-screening"),
  score: z.number().min(0).max(1),
});

export const decodeSnapshot = (dataUrl: string): Buffer =>
  Buffer.from(dataUrl.slice(dataUrl.indexOf(",") + 1), "base64");

/** JPEG files start with the SOI marker FF D8 FF. */
export const isJpeg = (bytes: Buffer): boolean =>
  bytes.length > 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
