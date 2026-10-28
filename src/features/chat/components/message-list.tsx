"use client";

import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import { type ChatEndReason, type ChatMessage, useChatStore } from "../store/chat-store";

const END_MESSAGES: Record<ChatEndReason, string> = {
  skipped: "Your partner moved on to someone else.",
  left: "Your partner left the chat.",
  disconnected: "Your partner lost their connection.",
  blocked: "You blocked this person. You will not be matched with them again.",
  reported:
    "Thanks, your report was sent to our moderators. You will not be matched with this person again.",
  connection: "Your connection dropped. The chat has ended.",
};

function SystemLine({ children }: { children: React.ReactNode }) {
  return <li className="py-1 text-center text-xs text-muted-foreground">{children}</li>;
}

function Bubble({ message }: { message: ChatMessage }) {
  const mine = message.author === "me";
  return (
    <li className={cn("flex", mine ? "justify-end" : "justify-start")}>
      <div className="flex max-w-[80%] flex-col gap-1">
        <p
          className={cn(
            "rounded-2xl px-3.5 py-2 text-sm leading-relaxed break-words whitespace-pre-wrap",
            mine
              ? "rounded-br-md bg-primary text-primary-foreground"
              : "rounded-bl-md bg-muted text-foreground",
            message.status === "sending" && "opacity-70",
          )}
        >
          <span className="sr-only">{mine ? "You: " : "Stranger: "}</span>
          {message.text}
        </p>
        {message.status === "failed" ? (
          <span className="self-end text-xs text-destructive">Not delivered</span>
        ) : null}
      </div>
    </li>
  );
}

export function MessageList() {
  const phase = useChatStore((state) => state.phase);
  const messages = useChatStore((state) => state.messages);
  const sharedInterests = useChatStore((state) => state.sharedInterests);
  const partnerTyping = useChatStore((state) => state.partnerTyping);
  const endedReason = useChatStore((state) => state.endedReason);
  const endRef = useRef<HTMLLIElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [messages.length, partnerTyping, phase]);

  const connected = phase === "chatting" || phase === "ended";

  return (
    <ol aria-label="Conversation" className="flex flex-col gap-2 px-4 py-6">
      {connected ? (
        <SystemLine>
          You are now chatting with a stranger.
          {sharedInterests.length > 0 ? ` You both like ${sharedInterests.join(", ")}.` : ""} Say
          hi.
        </SystemLine>
      ) : null}
      {messages.map((message) => (
        <Bubble key={message.id} message={message} />
      ))}
      {partnerTyping ? (
        <li aria-live="polite" className="text-xs text-muted-foreground">
          Stranger is typing
        </li>
      ) : null}
      {phase === "ended" && endedReason ? (
        <SystemLine>{END_MESSAGES[endedReason]}</SystemLine>
      ) : null}
      <li ref={endRef} aria-hidden className="h-px" />
    </ol>
  );
}
