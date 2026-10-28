"use client";

import Link from "next/link";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Kbd } from "@/components/shared/kbd";
import { ReportDialog } from "@/features/moderation/components/report-dialog";
import type { ChatMode } from "@/lib/constants";
import { useChat } from "../hooks/use-chat";
import { type ChatPhase, useChatStore } from "../store/chat-store";
import { Composer } from "./composer";
import { MessageList } from "./message-list";

const STATUS: Record<ChatPhase, string> = {
  connecting: "Connecting",
  searching: "Looking for someone to chat with",
  chatting: "Connected",
  ended: "Chat ended",
  stopped: "You left the chat",
  unavailable: "Chat unavailable",
};

function Unavailable({ reason }: { reason: "terms" | "session" | null }) {
  return (
    <div className="mx-auto flex max-w-md flex-1 flex-col items-start justify-center gap-4 px-4 py-16">
      <h1 className="text-xl font-semibold tracking-tight">
        {reason === "terms" ? "Please review the updated Terms" : "Start from the home page"}
      </h1>
      <p className="text-sm text-muted-foreground">
        {reason === "terms"
          ? "The Terms changed since you last accepted them. Accept the current version to keep chatting."
          : "Confirm you are 18 or older and accept the Terms before your first chat."}
      </p>
      <Button asChild>
        <Link href="/">Go to start</Link>
      </Button>
    </div>
  );
}

function Searching() {
  return (
    <div
      role="status"
      className="flex flex-1 flex-col items-center justify-center gap-3 px-4 text-center"
    >
      <span
        aria-hidden
        className="size-2.5 animate-pulse rounded-full bg-primary motion-reduce:animate-none"
      />
      <p className="text-sm font-medium">Looking for someone to chat with</p>
      <p className="max-w-xs text-xs text-muted-foreground">
        Shared interests come first. If nobody matches in a few seconds, you will meet someone at
        random.
      </p>
    </div>
  );
}

export function ChatScreen({ mode }: { mode: ChatMode }) {
  const { start, next, stop, block, reported, send, typed } = useChat(mode, { autoJoin: true });
  const phase = useChatStore((state) => state.phase);
  const notice = useChatStore((state) => state.notice);
  const unavailableReason = useChatStore((state) => state.unavailableReason);
  const reportableSessionId = useChatStore((state) => state.reportableSessionId);
  const endedReason = useChatStore((state) => state.endedReason);
  const canReport =
    (phase === "chatting" || phase === "ended") &&
    endedReason !== "reported" &&
    endedReason !== "blocked";
  const canSkip = phase === "chatting" || phase === "ended";

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && canSkip && !event.defaultPrevented) next();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [canSkip, next]);

  if (phase === "unavailable") return <Unavailable reason={unavailableReason} />;

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col">
      <div className="flex items-center justify-between gap-3 border-b px-4 py-2.5">
        <p className="text-sm text-muted-foreground" aria-live="polite">
          {STATUS[phase]}
        </p>
        <div className="flex items-center gap-1">
          {canReport ? (
            <ReportDialog sessionId={reportableSessionId} onReported={reported} />
          ) : null}
          {phase === "chatting" ? (
            <Button variant="ghost" size="sm" onClick={block}>
              Block
            </Button>
          ) : null}
          {phase !== "stopped" ? (
            <Button variant="ghost" size="sm" onClick={stop}>
              Stop
            </Button>
          ) : null}
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
        {phase === "searching" || phase === "connecting" ? <Searching /> : <MessageList />}
      </div>

      <div className="flex flex-col gap-2 border-t px-4 py-3">
        {notice ? (
          <p role="alert" className="text-xs text-destructive">
            {notice}
          </p>
        ) : null}
        <div className="flex items-end gap-2">
          {phase === "stopped" ? (
            <Button size="lg" className="h-10" onClick={start}>
              Start again
            </Button>
          ) : (
            <Button
              size="lg"
              variant="outline"
              className="h-10 shrink-0"
              onClick={next}
              disabled={!canSkip}
            >
              Next <Kbd>Esc</Kbd>
            </Button>
          )}
          <div className="min-w-0 flex-1">
            <Composer disabled={phase !== "chatting"} onSend={send} onTyping={typed} />
          </div>
        </div>
      </div>
    </div>
  );
}
