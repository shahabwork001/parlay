"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useSettingsStore } from "@/features/settings/store/settings-store";
import type { AvailableDevices, MediaErrorKind } from "@/services/media/media-devices";
import type { PreflightState } from "../hooks/use-video-call";
import { DeviceSelect } from "./device-select";
import { VideoTile } from "./video-tile";

const ERROR_COPY: Record<MediaErrorKind, { title: string; body: string }> = {
  denied: {
    title: "Camera and microphone are blocked",
    body: "Allow access in your browser's address bar (the camera icon), then try again.",
  },
  "not-found": {
    title: "No camera or microphone found",
    body: "Connect a camera and microphone, or continue with text chat.",
  },
  "in-use": {
    title: "Your camera is busy",
    body: "Another app or tab is using it. Close it, then try again.",
  },
  unsupported: {
    title: "Video is not available in this browser",
    body: "Use a current version of Chrome, Edge, Firefox or Safari over HTTPS.",
  },
  unknown: {
    title: "We could not start your camera",
    body: "Try again, or continue with text chat.",
  },
};

interface VideoPreflightProps {
  state: PreflightState;
  stream: MediaStream | null;
  devices: AvailableDevices;
  onRetry: () => void;
  onStart: () => void;
  onSwitchDevice: (kind: "camera" | "microphone", deviceId: string) => void;
}

/** Camera check before matching: mirrored preview, device choice, privacy option, clear errors. */
export function VideoPreflight({
  state,
  stream,
  devices,
  onRetry,
  onStart,
  onSwitchDevice,
}: VideoPreflightProps) {
  const cameraId = useSettingsStore((settings) => settings.cameraId);
  const microphoneId = useSettingsStore((settings) => settings.microphoneId);
  const relayOnly = useSettingsStore((settings) => settings.relayOnly);
  const setRelayOnly = useSettingsStore((settings) => settings.setRelayOnly);

  if (state.status === "error") {
    const copy = ERROR_COPY[state.kind];
    return (
      <div
        role="alert"
        className="mx-auto flex max-w-md flex-1 flex-col items-start justify-center gap-4 px-4 py-16"
      >
        <h1 className="text-xl font-semibold tracking-tight">{copy.title}</h1>
        <p className="text-sm text-muted-foreground">{copy.body}</p>
        <div className="flex flex-wrap gap-2">
          <Button onClick={onRetry}>Try again</Button>
          <Button asChild variant="outline">
            <Link href="/chat/text">Use text chat instead</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto grid w-full max-w-4xl flex-1 content-start gap-5 px-4 py-4 md:grid-cols-[1fr_18rem] md:content-center md:gap-8 md:py-8">
      <VideoTile
        stream={stream}
        label="Your camera"
        mirrored
        muted
        className="aspect-[3/4] max-h-[50dvh] w-full md:aspect-video md:max-h-none"
      >
        {state.status === "ready" ? null : "Waiting for camera access"}
      </VideoTile>
      <div className="flex flex-col gap-5">
        <div className="flex flex-col gap-1">
          <h1 className="text-lg font-semibold tracking-tight">Check your camera</h1>
          <p className="text-sm text-muted-foreground">
            This is how you will appear. Your video is never recorded.
          </p>
        </div>
        <DeviceSelect
          label="Camera"
          devices={devices.cameras}
          value={cameraId}
          onChange={(deviceId) => onSwitchDevice("camera", deviceId)}
        />
        <DeviceSelect
          label="Microphone"
          devices={devices.microphones}
          value={microphoneId}
          onChange={(deviceId) => onSwitchDevice("microphone", deviceId)}
        />
        <div className="flex items-start justify-between gap-3">
          <Label htmlFor="relay-only" className="flex flex-col items-start gap-1 font-normal">
            <span className="text-sm font-medium">Hide my IP address</span>
            <span className="text-xs text-muted-foreground">
              Route video through our relay. May add some delay.
            </span>
          </Label>
          <Switch id="relay-only" checked={relayOnly} onCheckedChange={setRelayOnly} />
        </div>
        <Button size="lg" onClick={onStart} disabled={state.status !== "ready"}>
          Start video chat
        </Button>
      </div>
    </div>
  );
}
