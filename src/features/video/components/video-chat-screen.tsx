"use client";

import { MessageSquareIcon, MicIcon, MicOffIcon, VideoIcon, VideoOffIcon } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Kbd } from "@/components/shared/kbd";
import { Button } from "@/components/ui/button";
import { Composer } from "@/features/chat/components/composer";
import { MessageList } from "@/features/chat/components/message-list";
import { ReportDialog } from "@/features/moderation/components/report-dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { type ChatPhase, useChatStore } from "@/features/chat/store/chat-store";
import { cn } from "@/lib/utils";
import { useVideoCall } from "../hooks/use-video-call";
import { QualityIndicator } from "./quality-indicator";
import { VideoPreflight } from "./video-preflight";
import { VideoTile } from "./video-tile";

function remoteOverlay(
  phase: ChatPhase,
  peerState: string | null,
  cameraOff: boolean,
): string | null {
  if (phase === "searching" || phase === "connecting") return "Looking for someone to chat with";
  if (phase === "stopped") return "You left the chat";
  if (phase === "ended") return "Chat ended. Press Next to meet someone new.";
  if (peerState === "reconnecting") return "Reconnecting";
  if (peerState !== "connected") return "Connecting video";
  if (cameraOff) return "Camera off";
  return null;
}

export function VideoChatScreen() {
  const call = useVideoCall();
  const { chat } = call;
  const phase = useChatStore((state) => state.phase);
  const unavailableReason = useChatStore((state) => state.unavailableReason);
  const reportableSessionId = useChatStore((state) => state.reportableSessionId);
  const endedReason = useChatStore((state) => state.endedReason);
  const [started, setStarted] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const canSkip = phase === "chatting" || phase === "ended";

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && canSkip && !event.defaultPrevented) chat.next();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [canSkip, chat]);

  if (phase === "unavailable") {
    return (
      <div className="mx-auto flex max-w-md flex-1 flex-col items-start justify-center gap-4 px-4 py-16">
        <h1 className="text-xl font-semibold tracking-tight">
          {unavailableReason === "terms"
            ? "Please review the updated Terms"
            : "Start from the home page"}
        </h1>
        <p className="text-sm text-muted-foreground">
          Confirm you are 18 or older and accept the current Terms before chatting.
        </p>
        <Button asChild>
          <Link href="/">Go to start</Link>
        </Button>
      </div>
    );
  }

  if (!started) {
    return (
      <VideoPreflight
        state={call.preflight}
        stream={call.localStream}
        devices={call.devices}
        onRetry={call.requestMedia}
        onSwitchDevice={(kind, deviceId) => void call.switchDevice(kind, deviceId)}
        onStart={() => {
          setStarted(true);
          chat.start();
        }}
      />
    );
  }

  const overlay = remoteOverlay(phase, call.peerState, !call.partnerMedia.video);
  const canReport =
    (phase === "chatting" || phase === "ended") &&
    endedReason !== "reported" &&
    endedReason !== "blocked";

  return (
    <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
      <div className="flex min-h-0 flex-1 flex-col gap-3 p-3">
        {call.screening === "flagged" ? (
          <Alert variant="destructive" role="alert">
            <AlertDescription>
              Your video may break the Community Guidelines, so your partner sees it blurred. Adjust
              your camera; repeated warnings lead to a temporary ban.
            </AlertDescription>
          </Alert>
        ) : null}
        <div className="grid min-h-0 flex-1 grid-cols-1 grid-rows-2 gap-3 md:grid-cols-2 md:grid-rows-1">
          <VideoTile
            stream={phase === "chatting" ? call.remoteStream : null}
            label="Stranger"
            hidden={!call.partnerMedia.video}
            className="min-h-0"
          >
            {overlay}
          </VideoTile>
          <VideoTile
            stream={call.localStream}
            label={call.localMedia.audio ? "You" : "You (muted)"}
            mirrored
            muted
            hidden={!call.localMedia.video}
            className="min-h-0"
          >
            {!call.localMedia.video
              ? "Your camera is off"
              : call.screening === "flagged"
                ? "Blurred for your partner"
                : null}
          </VideoTile>
        </div>

        <div
          role="toolbar"
          aria-label="Call controls"
          className="flex flex-wrap items-center justify-between gap-2 rounded-xl border bg-card px-3 py-2"
        >
          <div className="flex items-center gap-2">
            {phase === "stopped" ? (
              <Button onClick={chat.start}>Start again</Button>
            ) : (
              <Button onClick={chat.next} disabled={!canSkip}>
                Next <Kbd>Esc</Kbd>
              </Button>
            )}
            <Button
              variant="outline"
              size="icon"
              onClick={call.toggleMicrophone}
              aria-pressed={!call.localMedia.audio}
              aria-label={call.localMedia.audio ? "Mute microphone" : "Unmute microphone"}
            >
              {call.localMedia.audio ? <MicIcon aria-hidden /> : <MicOffIcon aria-hidden />}
            </Button>
            <Button
              variant="outline"
              size="icon"
              onClick={call.toggleCamera}
              aria-pressed={!call.localMedia.video}
              aria-label={call.localMedia.video ? "Turn camera off" : "Turn camera on"}
            >
              {call.localMedia.video ? <VideoIcon aria-hidden /> : <VideoOffIcon aria-hidden />}
            </Button>
            <Button
              variant="outline"
              size="icon"
              onClick={() => setChatOpen((open) => !open)}
              aria-pressed={chatOpen}
              aria-label={chatOpen ? "Hide chat" : "Show chat"}
            >
              <MessageSquareIcon aria-hidden />
            </Button>
          </div>
          <div className="flex items-center gap-1">
            {phase === "chatting" && call.peerState === "connected" ? (
              <QualityIndicator quality={call.quality} />
            ) : null}
            {canReport ? (
              <ReportDialog
                sessionId={reportableSessionId}
                captureSnapshot={call.capturePartnerFrame}
                onReported={chat.reported}
              />
            ) : null}
            {phase === "chatting" ? (
              <Button variant="ghost" size="sm" onClick={chat.block}>
                Block
              </Button>
            ) : null}
            {phase !== "stopped" ? (
              <Button variant="ghost" size="sm" onClick={chat.stop}>
                Stop
              </Button>
            ) : null}
          </div>
        </div>
      </div>

      <aside
        aria-label="Text chat"
        className={cn(
          "flex min-h-0 flex-col border-t lg:w-80 lg:border-t-0 lg:border-l",
          chatOpen ? "h-72 lg:h-auto" : "hidden",
        )}
      >
        <div className="min-h-0 flex-1 overflow-y-auto">
          <MessageList />
        </div>
        <div className="border-t p-3">
          <Composer disabled={phase !== "chatting"} onSend={chat.send} onTyping={chat.typed} />
        </div>
      </aside>
    </div>
  );
}
