"use client";

import { useCallback, useEffect, useRef } from "react";
import { usePreferencesStore } from "@/features/preferences/store/preferences-store";
import { playMatchSound } from "@/features/settings/match-sound";
import { useSettingsStore } from "@/features/settings/store/settings-store";
import { sessionStore, whenSessionReady } from "@/lib/auth/session-store";
import type { ChatMode } from "@/lib/constants";
import { TERMS_VERSION } from "@/lib/legal";
import { type ChatSocket, openChatConnection } from "@/services/realtime/chat-connection";
import { CONNECT_ERRORS, type MediaState, type RtcSignal } from "@/services/realtime/chat-events";
import { useChatStore } from "../store/chat-store";

const TYPING_THROTTLE_MS = 2000;
const TYPING_IDLE_MS = 3000;
const PARTNER_TYPING_TIMEOUT_MS = 5000;

export interface ChatOptions {
  /** Join the queue as soon as the socket connects (text). Video waits for the camera preflight. */
  readonly autoJoin: boolean;
  readonly onSignal?: (signal: RtcSignal) => void;
  readonly onMediaState?: (state: MediaState) => void;
}

/**
 * Drives one chat page: opens the socket, joins the queue with the saved preferences, maps server
 * events to the chat store and exposes the user actions. Closing the page leaves the chat.
 */
export function useChat(mode: ChatMode, options: ChatOptions) {
  const socketRef = useRef<ChatSocket | null>(null);
  const typingRef = useRef({ lastSent: 0, idleTimer: 0, partnerTimer: 0 });
  const optionsRef = useRef(options);

  useEffect(() => {
    optionsRef.current = options;
  });

  const join = useCallback(() => {
    const socket = socketRef.current;
    if (!socket) return;
    const { interests, language } = usePreferencesStore.getState();
    useChatStore.getState().searching();
    socket.emit("queue:join", { mode, language, interests }, (result) => {
      if (!result.ok) useChatStore.getState().setNotice(result.error.message);
    });
  }, [mode]);

  useEffect(() => {
    const store = useChatStore.getState();
    const typing = typingRef.current;
    store.reset();
    let disposed = false;

    void whenSessionReady().then(() => {
      if (disposed) return;
      const principal = sessionStore.getState().session?.principal;
      if (!principal) return store.unavailable("session");
      if (principal.termsVersion !== TERMS_VERSION) return store.unavailable("terms");

      const socket = openChatConnection((code) => {
        store.unavailable(code === CONNECT_ERRORS.termsOutdated ? "terms" : "session");
        socket.disconnect();
      });
      socketRef.current = socket;

      socket.on("connect", () => {
        const { phase } = useChatStore.getState();
        if (phase === "searching" || (phase === "connecting" && optionsRef.current.autoJoin))
          join();
      });
      socket.on("disconnect", (reason) => {
        // A search survives reconnection (it rejoins on connect); a live chat cannot.
        if (reason !== "io client disconnect" && useChatStore.getState().phase === "chatting") {
          useChatStore.getState().ended("connection");
        }
      });
      socket.on("match:found", (match) => {
        useChatStore.getState().matched(match);
        if (useSettingsStore.getState().matchSound) playMatchSound();
      });
      socket.on("match:ended", ({ reason }) => useChatStore.getState().ended(reason));
      socket.on("chat:message", (message) => useChatStore.getState().receiveMessage(message));
      socket.on("chat:typing", ({ typing: partnerTyping }) => {
        window.clearTimeout(typing.partnerTimer);
        useChatStore.getState().setPartnerTyping(partnerTyping);
        if (partnerTyping) {
          typing.partnerTimer = window.setTimeout(
            () => useChatStore.getState().setPartnerTyping(false),
            PARTNER_TYPING_TIMEOUT_MS,
          );
        }
      });
      socket.on("rtc:signal", (signal) => optionsRef.current.onSignal?.(signal));
      socket.on("media:state", (state) => optionsRef.current.onMediaState?.(state));
    });

    return () => {
      disposed = true;
      window.clearTimeout(typing.idleTimer);
      window.clearTimeout(typing.partnerTimer);
      socketRef.current?.disconnect();
      socketRef.current = null;
    };
  }, [join]);

  const next = useCallback(() => {
    const socket = socketRef.current;
    if (!socket?.connected) return;
    useChatStore.getState().searching();
    socket.emit("match:next", (result) => {
      if (!result.ok) join();
    });
  }, [join]);

  const stop = useCallback(() => {
    socketRef.current?.emit("queue:leave", () => undefined);
    useChatStore.getState().stopped();
  }, []);

  const block = useCallback(() => {
    socketRef.current?.emit("match:block", () => undefined);
    useChatStore.getState().ended("blocked");
  }, []);

  const send = useCallback((text: string) => {
    const socket = socketRef.current;
    const trimmed = text.trim();
    if (!socket || !trimmed) return;
    const localId = `local-${crypto.randomUUID()}`;
    useChatStore.getState().addOwnMessage(localId, trimmed);
    socket.emit("chat:message", { text: trimmed }, (result) => {
      if (result.ok) useChatStore.getState().confirmOwnMessage(localId, result.data);
      else {
        useChatStore.getState().failOwnMessage(localId);
        useChatStore.getState().setNotice(result.error.message);
      }
    });
    window.clearTimeout(typingRef.current.idleTimer);
    typingRef.current.lastSent = 0;
    socket.emit("chat:typing", { typing: false });
  }, []);

  /** Throttled typing signal: at most every 2 s, with a "stopped typing" after 3 s idle. */
  const typed = useCallback(() => {
    const socket = socketRef.current;
    if (!socket) return;
    const now = Date.now();
    if (now - typingRef.current.lastSent > TYPING_THROTTLE_MS) {
      typingRef.current.lastSent = now;
      socket.emit("chat:typing", { typing: true });
    }
    window.clearTimeout(typingRef.current.idleTimer);
    typingRef.current.idleTimer = window.setTimeout(() => {
      typingRef.current.lastSent = 0;
      socket.emit("chat:typing", { typing: false });
    }, TYPING_IDLE_MS);
  }, []);

  const sendSignal = useCallback((signal: RtcSignal) => {
    socketRef.current?.emit("rtc:signal", signal);
  }, []);

  const sendMediaState = useCallback((state: MediaState) => {
    socketRef.current?.emit("media:state", state);
  }, []);

  return { start: join, next, stop, block, send, typed, sendSignal, sendMediaState };
}
