"use client";

import { XIcon } from "lucide-react";
import { type KeyboardEvent, useId, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MAX_INTERESTS } from "@/lib/constants";
import { interestSchema } from "@/lib/schemas/preferences";
import { usePreferencesStore } from "../store/preferences-store";

const SUBMIT_KEYS = new Set(["Enter", ","]);

export function InterestInput() {
  const inputId = useId();
  const hintId = useId();
  const errorId = useId();
  const interests = usePreferencesStore((state) => state.interests);
  const addInterest = usePreferencesStore((state) => state.addInterest);
  const removeInterest = usePreferencesStore((state) => state.removeInterest);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const isFull = interests.length >= MAX_INTERESTS;

  function commitDraft() {
    if (!draft.trim()) return;
    const parsed = interestSchema.safeParse(draft);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Invalid interest.");
      return;
    }
    addInterest(parsed.data);
    setDraft("");
    setError(null);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (SUBMIT_KEYS.has(event.key)) {
      event.preventDefault();
      commitDraft();
      return;
    }
    if (event.key === "Backspace" && !draft) {
      const last = interests.at(-1);
      if (last) removeInterest(last);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={inputId}>Interests</Label>
      <Input
        id={inputId}
        value={draft}
        disabled={isFull}
        placeholder={isFull ? "Interest limit reached" : "music, travel, chess"}
        aria-describedby={error ? `${hintId} ${errorId}` : hintId}
        aria-invalid={error ? true : undefined}
        onChange={(event) => {
          setDraft(event.target.value);
          setError(null);
        }}
        onKeyDown={handleKeyDown}
        onBlur={commitDraft}
      />
      <p id={hintId} className="text-xs text-muted-foreground">
        Press Enter to add. You will be matched on shared interests first, then at random.
      </p>
      {error ? (
        <p id={errorId} role="alert" className="text-xs text-destructive">
          {error}
        </p>
      ) : null}
      {interests.length > 0 ? (
        <ul className="flex flex-wrap gap-1.5" aria-label="Selected interests">
          {interests.map((interest) => (
            <li key={interest}>
              <span className="inline-flex h-7 items-center gap-1 rounded-md border bg-muted pr-1 pl-2 text-xs">
                {interest}
                <button
                  type="button"
                  onClick={() => removeInterest(interest)}
                  className="inline-flex size-5 items-center justify-center rounded-sm text-muted-foreground hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                  aria-label={`Remove ${interest}`}
                >
                  <XIcon className="size-3" aria-hidden />
                </button>
              </span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
