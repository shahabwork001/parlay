/**
 * The last few messages of a live chat, held briefly so a report can include them. The platform
 * keeps no chat logs: this buffer expires minutes after the last message and is only copied into
 * evidence when someone reports the chat.
 */
export interface BufferedMessage {
  readonly senderSubjectId: string;
  readonly text: string;
  readonly sentAt: Date;
}

export interface RecentMessages {
  append(sessionId: string, message: BufferedMessage): Promise<void>;
  /** Oldest first. */
  list(sessionId: string): Promise<BufferedMessage[]>;
}

/** How many messages a report can include. */
export const REPORTED_MESSAGE_COUNT = 10;
