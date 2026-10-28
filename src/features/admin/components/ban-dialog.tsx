"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";

export const BAN_DURATIONS = [
  { value: "24", label: "24 hours", hours: 24 },
  { value: "72", label: "3 days", hours: 72 },
  { value: "168", label: "7 days", hours: 168 },
  { value: "720", label: "30 days", hours: 720 },
  { value: "permanent", label: "Permanent", hours: null },
] as const;

export interface BanChoice {
  readonly mode: "full" | "shadow";
  readonly durationHours: number | null;
  readonly includeNetwork: boolean;
  readonly message?: string;
  readonly note?: string;
}

/** Ban options for a report decision: type, duration, network and messages. */
export function BanDialog({
  open,
  onOpenChange,
  onConfirm,
  pending,
  defaultPermanent = false,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (choice: BanChoice) => void;
  pending: boolean;
  defaultPermanent?: boolean;
}) {
  const [mode, setMode] = useState<"full" | "shadow">("full");
  const [duration, setDuration] = useState<string>(defaultPermanent ? "permanent" : "72");
  const [includeNetwork, setIncludeNetwork] = useState(false);
  const [message, setMessage] = useState("");
  const [note, setNote] = useState("");

  function confirm(event: React.FormEvent) {
    event.preventDefault();
    const chosen = BAN_DURATIONS.find((option) => option.value === duration) ?? BAN_DURATIONS[1];
    onConfirm({
      mode,
      durationHours: chosen.hours,
      includeNetwork,
      ...(message.trim() ? { message: message.trim() } : {}),
      ...(note.trim() ? { note: note.trim() } : {}),
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-md">
        <form onSubmit={confirm} className="flex flex-col gap-5">
          <DialogHeader>
            <DialogTitle>Ban this person</DialogTitle>
            <DialogDescription>
              The ban covers their account (if any) and device. A full ban disconnects them now.
            </DialogDescription>
          </DialogHeader>

          <fieldset className="flex flex-col gap-2">
            <legend className="mb-2 text-sm font-medium">Type</legend>
            <RadioGroup value={mode} onValueChange={(value) => setMode(value as "full" | "shadow")}>
              <Label htmlFor="ban-full" className="flex items-start gap-3 font-normal">
                <RadioGroupItem id="ban-full" value="full" className="mt-0.5" />
                <span>
                  Full ban
                  <span className="block text-xs text-muted-foreground">
                    They see the reason and can appeal.
                  </span>
                </span>
              </Label>
              <Label htmlFor="ban-shadow" className="flex items-start gap-3 font-normal">
                <RadioGroupItem id="ban-shadow" value="shadow" className="mt-0.5" />
                <span>
                  Shadow ban
                  <span className="block text-xs text-muted-foreground">
                    They keep chatting, but only with other shadow-banned people. No notice.
                  </span>
                </span>
              </Label>
            </RadioGroup>
          </fieldset>

          <fieldset className="flex flex-col gap-2">
            <legend className="mb-2 text-sm font-medium">Duration</legend>
            <RadioGroup
              value={duration}
              onValueChange={setDuration}
              className="grid grid-cols-2 gap-2"
            >
              {BAN_DURATIONS.map((option) => (
                <Label
                  key={option.value}
                  htmlFor={`ban-duration-${option.value}`}
                  className="flex items-center gap-2 font-normal"
                >
                  <RadioGroupItem id={`ban-duration-${option.value}`} value={option.value} />
                  {option.label}
                </Label>
              ))}
            </RadioGroup>
          </fieldset>

          <Label htmlFor="ban-network" className="flex items-start gap-3 font-normal">
            <Checkbox
              id="ban-network"
              checked={includeNetwork}
              onCheckedChange={(checked) => setIncludeNetwork(checked === true)}
              className="mt-0.5"
            />
            <span>
              Also ban their network
              <span className="block text-xs text-muted-foreground">
                The IP address and its /24 or /64 range. This can affect other people on the same
                network; use it for repeat abuse only.
              </span>
            </span>
          </Label>

          <div className="flex flex-col gap-2">
            <Label htmlFor="ban-message">Message to the person (optional)</Label>
            <Textarea
              id="ban-message"
              rows={2}
              maxLength={500}
              value={message}
              onChange={(event) => setMessage(event.target.value)}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="ban-note">Internal note (optional)</Label>
            <Textarea
              id="ban-note"
              rows={2}
              maxLength={1000}
              value={note}
              onChange={(event) => setNote(event.target.value)}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="destructive" disabled={pending}>
              {pending ? "Banning" : "Ban"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
