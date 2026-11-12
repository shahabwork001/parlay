"use client";

import { SlidersHorizontalIcon } from "lucide-react";
import { useId, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { useSettingsStore } from "@/features/settings/store/settings-store";
import type { AvailableDevices } from "@/services/media/media-devices";
import { DeviceSelect } from "./device-select";

export interface VideoView {
  layout: "auto" | "focus" | "split";
  fit: "contain" | "cover";
  position: "top-right" | "top-left" | "bottom-right" | "bottom-left";
  size: "small" | "large";
  showSelf: boolean;
  mirror: boolean;
}

export const DEFAULT_VIDEO_VIEW: VideoView = {
  layout: "auto",
  fit: "contain",
  position: "top-right",
  size: "small",
  showSelf: true,
  mirror: true,
};

function Choice<T extends string>({
  label,
  value,
  onChange,
  children,
}: {
  label: string;
  value: T;
  onChange(value: T): void;
  children: ReactNode;
}) {
  const id = useId();
  return (
    <div className="flex flex-col gap-2 text-sm font-medium">
      <label htmlFor={id}>{label}</label>
      <select
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value as T)}
        className="min-h-11 w-full rounded-md border bg-background px-3 text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
      >
        {children}
      </select>
    </div>
  );
}

export function VideoViewSettings({
  view,
  onChange,
  onReset,
  open,
  onOpenChange,
  devices,
  switchDevice,
  fullscreenSupported,
  fullscreen,
  toggleFullscreen,
}: {
  view: VideoView;
  onChange(view: VideoView): void;
  onReset(): void;
  open: boolean;
  onOpenChange(open: boolean): void;
  devices: AvailableDevices;
  switchDevice(kind: "camera" | "microphone", id: string): Promise<void>;
  fullscreenSupported: boolean;
  fullscreen: boolean;
  toggleFullscreen(): Promise<void>;
}) {
  const cameraId = useSettingsStore((state) => state.cameraId);
  const microphoneId = useSettingsStore((state) => state.microphoneId);
  const [deviceBusy, setDeviceBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function changeDevice(kind: "camera" | "microphone", id: string) {
    if (deviceBusy) return;
    const previous = kind === "camera" ? cameraId : microphoneId;
    setDeviceBusy(true);
    setError(null);
    try {
      await switchDevice(kind, id);
    } catch {
      if (kind === "camera") useSettingsStore.getState().setCamera(previous);
      else useSettingsStore.getState().setMicrophone(previous);
      setError("Could not switch devices. Check permissions or choose another device.");
    } finally {
      setDeviceBusy(false);
    }
  }
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          size="icon"
          className="size-11"
          aria-label="Video settings"
          title="Video settings"
        >
          <SlidersHorizontalIcon aria-hidden />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[85dvh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Video settings</DialogTitle>
          <DialogDescription>
            Adjust your view without interrupting the call. Layout, framing and mirroring only
            change what you see.
          </DialogDescription>
        </DialogHeader>
        <Choice
          label="Layout"
          value={view.layout}
          onChange={(layout) => onChange({ ...view, layout })}
        >
          <option value="auto">Automatic</option>
          <option value="focus">Main video with preview</option>
          <option value="split">Equal tiles</option>
        </Choice>
        <Choice
          label="Video framing"
          value={view.fit}
          onChange={(fit) => onChange({ ...view, fit })}
        >
          <option value="contain">Fit — show the full frame</option>
          <option value="cover">Fill — crop to fill the tile</option>
        </Choice>
        <label className="flex min-h-11 items-center justify-between gap-4">
          <span>
            Show my preview
            <span className="block text-xs text-muted-foreground">
              Hiding this does not turn your camera off.
            </span>
          </span>
          <Switch
            checked={view.showSelf}
            onCheckedChange={(showSelf) => onChange({ ...view, showSelf })}
          />
        </label>
        <label className="flex min-h-11 items-center justify-between gap-4">
          <span>
            Mirror my preview
            <span className="block text-xs text-muted-foreground">
              Your partner sees the original camera image.
            </span>
          </span>
          <Switch
            checked={view.mirror}
            onCheckedChange={(mirror) => onChange({ ...view, mirror })}
          />
        </label>
        {view.showSelf && view.layout !== "split" ? (
          <div className="grid grid-cols-2 gap-3">
            <Choice
              label="Preview position"
              value={view.position}
              onChange={(position) => onChange({ ...view, position })}
            >
              <option value="top-right">Top right</option>
              <option value="top-left">Top left</option>
              <option value="bottom-right">Bottom right</option>
              <option value="bottom-left">Bottom left</option>
            </Choice>
            <Choice
              label="Preview size"
              value={view.size}
              onChange={(size) => onChange({ ...view, size })}
            >
              <option value="small">Small</option>
              <option value="large">Large</option>
            </Choice>
            <p className="col-span-2 text-xs text-muted-foreground">
              Preview options apply to the inset view. Automatic uses equal tiles on larger screens.
            </p>
          </div>
        ) : null}
        <fieldset
          disabled={deviceBusy}
          className="flex flex-col gap-3 border-t pt-4"
          aria-busy={deviceBusy}
        >
          <legend className="text-sm font-medium">Camera and microphone</legend>
          <DeviceSelect
            label="Camera"
            devices={devices.cameras}
            value={cameraId}
            onChange={(id) => void changeDevice("camera", id)}
          />
          <DeviceSelect
            label="Microphone"
            devices={devices.microphones}
            value={microphoneId}
            onChange={(id) => void changeDevice("microphone", id)}
          />
        </fieldset>
        {error ? (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        ) : null}
        {fullscreenSupported ? (
          <Button
            variant="outline"
            className="min-h-11"
            onClick={() => {
              setError(null);
              void toggleFullscreen().catch(() =>
                setError("Full screen is unavailable right now. Try again from your browser."),
              );
            }}
          >
            {fullscreen ? "Exit full screen" : "Enter full screen"}
          </Button>
        ) : null}
        <div className="flex flex-wrap justify-between gap-2 border-t pt-3">
          <Button variant="ghost" className="min-h-11" onClick={onReset}>
            Reset view
          </Button>
          <Button className="min-h-11" onClick={() => onOpenChange(false)}>
            Done
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
