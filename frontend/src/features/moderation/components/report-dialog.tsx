"use client";

import { useMutation } from "@tanstack/react-query";
import { FlagIcon } from "lucide-react";
import { useRef, useState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
import { errorMessage } from "@/lib/http/error-messages";
import { isMinorSafety, REPORT_CATEGORIES, type ReportCategory } from "@/lib/report-categories";
import { moderationRepository } from "@/repositories/moderation-repository";

export interface ReportDialogProps {
  readonly sessionId: string | null;
  /** Video chats attach a still frame of the partner, taken the moment Report is pressed. */
  readonly captureSnapshot?: () => Promise<string | null>;
  readonly onReported: () => void;
}

/**
 * Report the current (or just ended) partner. Submitting ends the chat and blocks them; the
 * disclosure tells the reporter exactly what is sent.
 */
export function ReportDialog({ sessionId, captureSnapshot, onReported }: ReportDialogProps) {
  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState<ReportCategory | null>(null);
  const [note, setNote] = useState("");
  const [missingCategory, setMissingCategory] = useState(false);
  const snapshotRef = useRef<Promise<string | null>>(Promise.resolve(null));

  const report = useMutation({
    mutationFn: async (input: { sessionId: string; category: ReportCategory }) => {
      const snapshot = await snapshotRef.current;
      return moderationRepository.submitReport({
        sessionId: input.sessionId,
        category: input.category,
        ...(note.trim() ? { note: note.trim() } : {}),
        ...(snapshot ? { snapshot } : {}),
      });
    },
    onSuccess: () => {
      setOpen(false);
      onReported();
    },
  });

  function changeOpen(next: boolean) {
    if (next) {
      snapshotRef.current = captureSnapshot ? captureSnapshot() : Promise.resolve(null);
      setCategory(null);
      setNote("");
      setMissingCategory(false);
      report.reset();
    }
    setOpen(next);
  }

  function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!sessionId) return;
    if (!category) {
      setMissingCategory(true);
      return;
    }
    report.mutate({ sessionId, category });
  }

  return (
    <Dialog open={open} onOpenChange={changeOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" disabled={!sessionId}>
          <FlagIcon aria-hidden />
          Report
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-md">
        <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
          <DialogHeader>
            <DialogTitle>Report this person</DialogTitle>
            <DialogDescription>
              The chat ends and you will not be matched with them again.{" "}
              {captureSnapshot
                ? "We send a still image of their video and the last messages of this chat to our moderators."
                : "We send the last messages of this chat to our moderators."}
            </DialogDescription>
          </DialogHeader>

          <fieldset className="flex flex-col gap-2">
            <legend className="mb-2 text-sm font-medium">What happened?</legend>
            <RadioGroup
              value={category ?? ""}
              onValueChange={(value) => {
                setCategory(value as ReportCategory);
                setMissingCategory(false);
              }}
              aria-invalid={missingCategory}
              aria-describedby={missingCategory ? "report-category-error" : undefined}
              className="gap-1"
            >
              {REPORT_CATEGORIES.map((option) => (
                <Label
                  key={option.value}
                  htmlFor={`report-${option.value}`}
                  className="flex cursor-pointer items-center gap-3 rounded-md px-2 py-2 font-normal hover:bg-muted"
                >
                  <RadioGroupItem id={`report-${option.value}`} value={option.value} />
                  {option.label}
                </Label>
              ))}
            </RadioGroup>
            {missingCategory ? (
              <p id="report-category-error" className="text-xs text-destructive">
                Choose what happened.
              </p>
            ) : null}
          </fieldset>

          {category && isMinorSafety(category) ? (
            <Alert>
              <AlertDescription>
                Reports about minors go to the front of the review queue, and the person is
                suspended while we review it.
              </AlertDescription>
            </Alert>
          ) : null}

          <div className="flex flex-col gap-2">
            <Label htmlFor="report-note">Anything else? (optional)</Label>
            <Textarea
              id="report-note"
              value={note}
              maxLength={500}
              rows={3}
              onChange={(event) => setNote(event.target.value)}
            />
          </div>

          {report.error ? (
            <p role="alert" className="text-sm text-destructive">
              {errorMessage(report.error)}
            </p>
          ) : null}

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => changeOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="destructive" disabled={report.isPending}>
              {report.isPending ? "Sending report" : "Send report"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
