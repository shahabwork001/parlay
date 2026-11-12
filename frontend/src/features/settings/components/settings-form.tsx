"use client";

import { useTheme } from "next-themes";
import { type ReactNode, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Switch } from "@/components/ui/switch";
import { DeviceSelect } from "@/features/video/components/device-select";
import {
  type AvailableDevices,
  isMediaSupported,
  listDevices,
  openLocalMedia,
  stopStream,
} from "@/services/media/media-devices";
import { useSettingsStore } from "../store/settings-store";

const THEMES = [
  { value: "system", label: "System" },
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
] as const;

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <section className="flex flex-col gap-4 border-t pt-6">
      <div className="flex flex-col gap-1">
        <h2 className="text-sm font-medium">{title}</h2>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      {children}
    </section>
  );
}

function ToggleRow({
  id,
  label,
  description,
  checked,
  onChange,
}: {
  id: string;
  label: string;
  description: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <Label htmlFor={id} className="flex flex-col items-start gap-1 font-normal">
        <span className="text-sm font-medium">{label}</span>
        <span className="text-xs text-muted-foreground">{description}</span>
      </Label>
      <Switch id={id} checked={checked} onCheckedChange={onChange} />
    </div>
  );
}

/** Device settings need one camera/mic grant before browsers reveal device names. */
function DeviceSettings() {
  const settings = useSettingsStore();
  const [devices, setDevices] = useState<AvailableDevices | null>(null);
  const [denied, setDenied] = useState(false);

  useEffect(() => {
    if (!isMediaSupported()) return;
    let active = true;
    void listDevices().then((available) => {
      if (active && available.cameras.some((camera) => camera.label)) setDevices(available);
    });
    return () => {
      active = false;
    };
  }, []);

  async function allowAccess() {
    try {
      const stream = await openLocalMedia({ cameraId: null, microphoneId: null });
      stopStream(stream);
      setDevices(await listDevices());
      setDenied(false);
    } catch {
      setDenied(true);
    }
  }

  if (!devices) {
    return (
      <div className="flex flex-col items-start gap-2">
        <Button variant="outline" onClick={() => void allowAccess()}>
          Show my camera and microphone
        </Button>
        {denied ? (
          <p className="text-xs text-destructive">
            Access was blocked. Allow it in your browser settings.
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <DeviceSelect
        label="Camera"
        devices={devices.cameras}
        value={settings.cameraId}
        onChange={settings.setCamera}
      />
      <DeviceSelect
        label="Microphone"
        devices={devices.microphones}
        value={settings.microphoneId}
        onChange={settings.setMicrophone}
      />
    </div>
  );
}

export function SettingsForm() {
  const { theme, setTheme } = useTheme();
  const relayOnly = useSettingsStore((state) => state.relayOnly);
  const setRelayOnly = useSettingsStore((state) => state.setRelayOnly);
  const matchSound = useSettingsStore((state) => state.matchSound);
  const setMatchSound = useSettingsStore((state) => state.setMatchSound);

  return (
    <div className="flex flex-col gap-6">
      <Section title="Appearance" description="Choose how Parley looks on this device.">
        <RadioGroup
          value={theme ?? "system"}
          onValueChange={setTheme}
          className="flex flex-wrap gap-4"
          aria-label="Theme"
        >
          {THEMES.map((option) => (
            <div key={option.value} className="flex items-center gap-2">
              <RadioGroupItem id={`theme-${option.value}`} value={option.value} />
              <Label htmlFor={`theme-${option.value}`} className="font-normal">
                {option.label}
              </Label>
            </div>
          ))}
        </RadioGroup>
      </Section>

      <Section title="Camera and microphone" description="Used by default for video chats.">
        <DeviceSettings />
      </Section>

      <Section title="Privacy" description="Settings are stored only in this browser.">
        <ToggleRow
          id="settings-relay-only"
          label="Hide my IP address in video chats"
          description="Routes video through our relay so the other person cannot see your IP address. May add some delay."
          checked={relayOnly}
          onChange={setRelayOnly}
        />
      </Section>

      <Section title="Notifications" description="Sounds play only while Parley is open.">
        <ToggleRow
          id="settings-match-sound"
          label="Play a sound when someone joins"
          description="A short chime when you are connected to a new person."
          checked={matchSound}
          onChange={setMatchSound}
        />
      </Section>
    </div>
  );
}
