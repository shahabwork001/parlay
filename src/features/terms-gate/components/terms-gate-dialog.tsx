"use client";

import Link from "next/link";
import { useState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ConsentCheckbox } from "@/features/auth/components/consent-checkbox";

interface TermsGateDialogProps {
  open: boolean;
  submitting: boolean;
  error: string | null;
  onAccept: () => void;
  onCancel: () => void;
}

/** Mandatory before any chat: adults only, and acceptance of the Terms and Community Guidelines. */
export function TermsGateDialog({
  open,
  submitting,
  error,
  onAccept,
  onCancel,
}: TermsGateDialogProps) {
  const [ageConfirmed, setAgeConfirmed] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) onCancel();
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Before you start</DialogTitle>
          <DialogDescription>
            Parley is for adults only. Conversations are with strangers and are moderated, but never
            recorded.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-4 py-2">
          <ConsentCheckbox
            checked={ageConfirmed}
            onCheckedChange={(value) => setAgeConfirmed(value === true)}
          >
            I am 18 or older.
          </ConsentCheckbox>
          <ConsentCheckbox
            checked={termsAccepted}
            onCheckedChange={(value) => setTermsAccepted(value === true)}
          >
            I agree to the{" "}
            <Link href="/terms" target="_blank" className="underline underline-offset-2">
              Terms
            </Link>{" "}
            and{" "}
            <Link href="/guidelines" target="_blank" className="underline underline-offset-2">
              Community Guidelines
            </Link>
            , including that a still image and recent messages are attached when someone reports me.
          </ConsentCheckbox>
          {error ? (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button onClick={onAccept} disabled={!ageConfirmed || !termsAccepted || submitting}>
            {submitting ? "Starting" : "Agree and continue"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
