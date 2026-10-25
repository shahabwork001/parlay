import { create } from "zustand";
import type { ChatMessagePayload, EndReason, MatchFound } from "@/services/realtime/chat-events";

export type ChatPhase =
  "connecting" | "searching" | "chatting" | "ended" | "stopped" | "unavailable";

export type ChatEndReason = EndReason | "blocked" | "connection";

export interface ChatMessage {
  readonly id: string;
  readonly author: "me" | "partner";
  readonly text: string;
  readonly status: "sending" | "sent" | "failed";
}

interface ChatState {
  phase: ChatPhase;
  sessionId: string | null;
  sharedInterests: readonly string[];
  messages: readonly ChatMessage[];
  partnerTyping: boolean;
  endedReason: ChatEndReason | null;
  /** Why chat cannot start (e.g. the Terms changed); shown instead of the chat. */
  unavailableReason: "terms" | "session" | null;
  notice: string | null;

  reset(): void;
  searching(): void;
  matched(match: MatchFound): void;
  ended(reason: ChatEndReason): void;
  stopped(): void;
  unavailable(reason: "terms" | "session"): void;
  addOwnMessage(localId: string, text: string): void;
  confirmOwnMessage(localId: string, delivered: ChatMessagePayload): void;
  failOwnMessage(localId: string): void;
  receiveMessage(message: ChatMessagePayload): void;
  setPartnerTyping(typing: boolean): void;
  setNotice(notice: string | null): void;
}

const initial = {
  phase: "connecting" as ChatPhase,
  sessionId: null,
  sharedInterests: [],
  messages: [],
  partnerTyping: false,
  endedReason: null,
  unavailableReason: null,
  notice: null,
};

/** Chat screen state. Transitions mirror server events; components only read and call actions. */
export const useChatStore = create<ChatState>()((set) => ({
  ...initial,
  reset: () => set(initial),
  searching: () =>
    set({
      phase: "searching",
      sessionId: null,
      messages: [],
      partnerTyping: false,
      endedReason: null,
      notice: null,
    }),
  matched: (match) =>
    set({
      phase: "chatting",
      sessionId: match.sessionId,
      sharedInterests: match.sharedInterests,
      messages: [],
      partnerTyping: false,
      endedReason: null,
      notice: null,
    }),
  ended: (reason) =>
    set((state) =>
      state.phase === "chatting" || state.phase === "searching"
        ? { phase: "ended", endedReason: reason, partnerTyping: false, sessionId: null }
        : state,
    ),
  stopped: () => set({ phase: "stopped", sessionId: null, partnerTyping: false }),
  unavailable: (reason) => set({ phase: "unavailable", unavailableReason: reason }),
  addOwnMessage: (localId, text) =>
    set((state) => ({
      messages: [...state.messages, { id: localId, author: "me", text, status: "sending" }],
    })),
  confirmOwnMessage: (localId, delivered) =>
    set((state) => ({
      messages: state.messages.map((message) =>
        message.id === localId
          ? { ...message, id: delivered.id, text: delivered.text, status: "sent" }
          : message,
      ),
    })),
  failOwnMessage: (localId) =>
    set((state) => ({
      messages: state.messages.map((message) =>
        message.id === localId ? { ...message, status: "failed" } : message,
      ),
    })),
  receiveMessage: (message) =>
    set((state) => ({
      partnerTyping: false,
      messages: [
        ...state.messages,
        { id: message.id, author: "partner", text: message.text, status: "sent" },
      ],
    })),
  setPartnerTyping: (typing) => set({ partnerTyping: typing }),
  setNotice: (notice) => set({ notice }),
}));
