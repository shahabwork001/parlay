"use client";

import { useId } from "react";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface DeviceSelectProps {
  label: string;
  devices: readonly MediaDeviceInfo[];
  value: string | null;
  onChange: (deviceId: string) => void;
}

export function DeviceSelect({ label, devices, value, onChange }: DeviceSelectProps) {
  const id = useId();
  const current =
    value && devices.some((device) => device.deviceId === value) ? value : devices[0]?.deviceId;

  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={id}>{label}</Label>
      <Select value={current} onValueChange={onChange} disabled={devices.length === 0}>
        <SelectTrigger id={id} className="w-full">
          <SelectValue placeholder="No device found" />
        </SelectTrigger>
        <SelectContent>
          {devices.map((device, index) => (
            <SelectItem key={device.deviceId} value={device.deviceId}>
              {device.label || `${label} ${index + 1}`}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
