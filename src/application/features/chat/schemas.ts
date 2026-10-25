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
