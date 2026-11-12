"use client";

import {
  Maximize2Icon,
  MessageSquareIcon,
  MicIcon,
  MicOffIcon,
  VideoIcon,
  VideoOffIcon,
} from "lucide-react";
import { useEffect, useState } from "react";
import { Kbd } from "@/components/shared/kbd";
import { Button } from "@/components/ui/button";
import { ChatUnavailable } from "@/features/chat/components/chat-unavailable";
import { InteractionControls } from "@/features/chat/components/interaction-controls";
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
import { DEFAULT_VIDEO_VIEW, VideoViewSettings } from "./video-view-settings";

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
  const notice = useChatStore((state) => state.notice);
  const [started, setStarted] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [selfExpanded, setSelfExpanded] = useState(false);
  const [view, setView] = useState({ ...DEFAULT_VIDEO_VIEW });
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [fullscreenSupported, setFullscreenSupported] = useState(false);
  const canSkip = phase === "chatting" || phase === "ended";

  useEffect(() => {
    const changed = () => setFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", changed);
    return () => document.removeEventListener("fullscreenchange", changed);
  }, []);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (
        event.key === "Escape" &&
        canSkip &&
        !settingsOpen &&
        !fullscreen &&
        !document.fullscreenElement &&
        !event.defaultPrevented
      )
        chat.next();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [canSkip, chat, settingsOpen, fullscreen]);

  if (phase === "unavailable") return <ChatUnavailable reason={unavailableReason} />;

  if (!started) {
    return (
      <>
        <InteractionControls {...chat} />
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
      </>
    );
  }

  const overlay = remoteOverlay(phase, call.peerState, !call.partnerMedia.video);
  const canReport =
    (phase === "chatting" || phase === "ended") &&
    endedReason !== "reported" &&
    endedReason !== "blocked";

  const focusSelf = view.showSelf && selfExpanded;
  const split = view.showSelf && view.layout === "split";
  const automatic = view.showSelf && view.layout === "auto";
  const insetPosition = {
    "top-right": "top-3 right-3",
    "top-left": "top-3 left-3",
    "bottom-right": "bottom-3 right-3",
    "bottom-left": "bottom-3 left-3",
  }[view.position];
  function tileClass(self: boolean) {
    if (!view.showSelf) return self ? "hidden" : "absolute inset-0";
    if (split) return "relative min-h-0";
    return cn(
      automatic &&
        "md:relative md:inset-auto md:z-auto md:aspect-auto md:h-auto md:min-h-0 md:w-auto",
      self === focusSelf
        ? "absolute inset-0"
        : cn(
            "absolute z-10 aspect-[3/4] max-h-[45%] max-w-[40%] shadow-lg",
            insetPosition,
            view.size === "large" ? "w-36" : "w-24 sm:w-32",
          ),
    );
  }
  const swapButton =
    view.showSelf && !split ? (
      <button
        type="button"
        onClick={() => setSelfExpanded((expanded) => !expanded)}
        aria-label={focusSelf ? "Enlarge stranger's video" : "Enlarge your video"}
        aria-pressed={focusSelf}
        title={focusSelf ? "Enlarge stranger's video" : "Enlarge your video"}
        className={cn(
          "flex size-11 items-center justify-center rounded-lg bg-black/70 text-white focus-visible:ring-2 focus-visible:ring-white focus-visible:outline-none",
          automatic && "md:hidden",
        )}
      >
        <Maximize2Icon className="size-4" aria-hidden />
      </button>
    ) : null;

  return (
    <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
      <div className="flex min-h-0 flex-1 flex-col gap-3 p-3">
        <InteractionControls {...chat} />
        {notice ? (
          <Alert role="alert">
            <AlertDescription>{notice}</AlertDescription>
          </Alert>
        ) : null}
        {call.screening === "flagged" ? (
          <Alert variant="destructive" role="alert">
            <AlertDescription>
              Your video may break the Community Guidelines, so your partner sees it blurred. Adjust
              your camera; repeated warnings lead to a temporary ban.
            </AlertDescription>
          </Alert>
        ) : null}
        <div
          className={cn(
            "relative min-h-56 flex-1",
            automatic && "md:grid md:grid-cols-2 md:gap-3",
            split && "grid grid-rows-2 gap-3 md:grid-cols-2 md:grid-rows-1",
          )}
        >
          <VideoTile
            stream={phase === "chatting" ? call.remoteStream : null}
            label="Stranger"
            hidden={!call.partnerMedia.video}
            fit={view.fit}
            className={tileClass(false)}
            controls={focusSelf ? swapButton : null}
          >
            {overlay}
          </VideoTile>
          <VideoTile
            stream={call.localStream}
            label={call.localMedia.audio ? "You" : "You (muted)"}
            mirrored={view.mirror}
            muted
            hidden={!call.localMedia.video}
            fit={view.fit}
            className={tileClass(true)}
            controls={!focusSelf ? swapButton : null}
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
          className="flex shrink-0 flex-wrap items-center justify-between gap-2 rounded-xl border bg-card px-3 py-2"
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
              className="size-11"
              onClick={call.toggleMicrophone}
              aria-pressed={!call.localMedia.audio}
              aria-label={call.localMedia.audio ? "Mute microphone" : "Unmute microphone"}
            >
              {call.localMedia.audio ? <MicIcon aria-hidden /> : <MicOffIcon aria-hidden />}
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="size-11"
              onClick={call.toggleCamera}
              aria-pressed={!call.localMedia.video}
              aria-label={call.localMedia.video ? "Turn camera off" : "Turn camera on"}
            >
              {call.localMedia.video ? <VideoIcon aria-hidden /> : <VideoOffIcon aria-hidden />}
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="size-11"
              onClick={() => setChatOpen((open) => !open)}
              aria-pressed={chatOpen}
              aria-label={chatOpen ? "Hide chat" : "Show chat"}
            >
              <MessageSquareIcon aria-hidden />
            </Button>
            <VideoViewSettings
              view={view}
              onReset={() => {
                setView({ ...DEFAULT_VIDEO_VIEW });
                setSelfExpanded(false);
              }}
              onChange={(next) => {
                setView(next);
                if (!next.showSelf || next.layout === "split") setSelfExpanded(false);
              }}
              open={settingsOpen}
              onOpenChange={(open) => {
                setFullscreenSupported(
                  Boolean(document.fullscreenEnabled && document.documentElement.requestFullscreen),
                );
                setSettingsOpen(open);
              }}
              devices={call.devices}
              switchDevice={call.switchDevice}
              fullscreenSupported={fullscreenSupported}
              fullscreen={fullscreen}
              toggleFullscreen={async () => {
                if (document.fullscreenElement) await document.exitFullscreen();
                else await document.documentElement.requestFullscreen();
              }}
            />
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
