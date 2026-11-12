"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface Props {
  interaction: "general" | "adult";
  selectInteraction(mode: "general" | "adult"): void;
  consentRequired: boolean;
  consent(): void;
  cancelConsent(): void;
}

/** Selection ends the current session; consent is never persisted between searches. */
export function InteractionControls(props: Props) {
  return (
    <div className="flex flex-col gap-2 border-b p-3">
      <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Interaction mode">
        <Button
          size="sm"
          variant={props.interaction === "general" ? "default" : "outline"}
          aria-pressed={props.interaction === "general"}
          onClick={() => props.selectInteraction("general")}
        >
          General Chat
        </Button>
        <Button
          size="sm"
          variant={props.interaction === "adult" ? "default" : "outline"}
          aria-pressed={props.interaction === "adult"}
          onClick={() => props.selectInteraction("adult")}
        >
          Adult Chat · 18+
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        {props.interaction === "adult"
          ? "Adult Chat permits consensual explicit conversations and nudity. Verified age is required; access is unavailable until verification is configured. Stop ends the session and withdraws consent."
          : "General Chat: no explicit sexual content. Changing modes ends your current chat. Start again when ready."}
      </p>
      <Dialog
        open={props.consentRequired}
        onOpenChange={(open) => {
          if (!open) props.cancelConsent();
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Consent to an Adult Chat search</DialogTitle>
            <DialogDescription>
              Only age-verified adults who explicitly opt in can match here. I agree to meet a new
              adult partner in a space permitting consensual explicit conversation and nudity. This
              does not authorize recording, coercion or any activity without mutual consent. I can
              stop immediately. This permission applies only to this search and resulting session.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={props.cancelConsent}>
              Cancel
            </Button>
            <Button onClick={props.consent}>I consent · Search Adult Chat</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
