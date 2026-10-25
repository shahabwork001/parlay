import { z } from "zod";
import { CHAT_MODES } from "./chat-types.js";

export const MAX_INTERESTS = 10;
export const MAX_MESSAGE_LENGTH = 1000;

const interestSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(2)
  .max(24)
  .regex(/^[\p{L}\p{N}][\p{L}\p{N} -]*$/u);

/** Socket event payloads. Every inbound event is validated before it reaches any logic. */
export const joinQueueSchema = z.object({
  mode: z.enum(CHAT_MODES),
  language: z.string().regex(/^(any|[a-z]{2})$/),
  interests: z
    .array(interestSchema)
    .max(MAX_INTERESTS)
    .transform((interests) => [...new Set(interests)]),
});

export const chatMessageSchema = z.object({
  text: z.string().max(MAX_MESSAGE_LENGTH * 2),
});

export const typingSchema = z.object({ typing: z.boolean() });

export type JoinQueueRequest = z.infer<typeof joinQueueSchema>;

const MAX_SDP_LENGTH = 32 * 1024;

/**
 * WebRTC signaling relayed between the two participants of a video session: either a session
 * description (offer/answer) or an ICE candidate. The server never interprets SDP; it only bounds it.
 */
export const rtcSignalSchema = z.union([
  z.object({
    description: z.object({
      type: z.enum(["offer", "answer", "rollback"]),
      sdp: z.string().max(MAX_SDP_LENGTH),
    }),
  }),
  z.object({
    candidate: z.object({
      candidate: z.string().max(1024),
      sdpMid: z.string().max(64).nullable().optional(),
      sdpMLineIndex: z.number().int().min(0).max(64).nullable().optional(),
      usernameFragment: z.string().max(256).nullable().optional(),
    }),
  }),
]);

/** Lets the partner show "camera off" or "muted" instead of a frozen frame. */
export const mediaStateSchema = z.object({ audio: z.boolean(), video: z.boolean() });

export type RtcSignal = z.infer<typeof rtcSignalSchema>;
export type MediaState = z.infer<typeof mediaStateSchema>;
