"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { errorMessage } from "@/lib/http/error-messages";
import { adminRepository, type TextRules } from "@/repositories/admin-repository";
import { PageHeader, QueryView } from "./admin-ui";

const rulesKey = ["admin", "rules", "text"] as const;

const toLines = (words: readonly string[]) => words.join("\n");
const fromLines = (text: string) =>
  text
    .split(/[\n,]/)
    .map((word) => word.trim())
    .filter(Boolean);

function RulesForm({ initial }: { initial: TextRules }) {
  const queryClient = useQueryClient();
  const [masked, setMasked] = useState(toLines(initial.maskedWords));
  const [blocked, setBlocked] = useState(toLines(initial.blockedWords));
  const [flags, setFlags] = useState({
    removeLinks: initial.removeLinks,
    removePhoneNumbers: initial.removePhoneNumbers,
    removeSocialHandles: initial.removeSocialHandles,
  });
  const [maxRepeats, setMaxRepeats] = useState(String(initial.maxRepeats));
  const [repeatWindow, setRepeatWindow] = useState(String(initial.repeatWindowSeconds));

  const save = useMutation({
    mutationFn: () =>
      adminRepository.saveTextRules({
        maskedWords: fromLines(masked),
        blockedWords: fromLines(blocked),
        ...flags,
        maxRepeats: Number(maxRepeats),
        repeatWindowSeconds: Number(repeatWindow),
      }),
    onSuccess: (saved) => {
      queryClient.setQueryData(rulesKey, saved);
      setMasked(toLines(saved.maskedWords));
      setBlocked(toLines(saved.blockedWords));
    },
  });

  const flag = (key: keyof typeof flags, label: string) => (
    <Label htmlFor={`rule-${key}`} className="flex items-center gap-2 font-normal">
      <Checkbox
        id={`rule-${key}`}
        checked={flags[key]}
        onCheckedChange={(checked) =>
          setFlags((current) => ({ ...current, [key]: checked === true }))
        }
      />
      {label}
    </Label>
  );

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        save.mutate();
      }}
      className="flex flex-col gap-6"
    >
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Label htmlFor="rules-blocked">Blocked words</Label>
          <p id="rules-blocked-hint" className="text-xs text-muted-foreground">
            Slurs and threats. A message containing one is not delivered and lowers the
            sender&apos;s trust. One per line.
          </p>
          <Textarea
            id="rules-blocked"
            aria-describedby="rules-blocked-hint"
            rows={12}
            value={blocked}
            onChange={(event) => setBlocked(event.target.value)}
            className="font-mono text-xs"
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="rules-masked">Masked words</Label>
          <p id="rules-masked-hint" className="text-xs text-muted-foreground">
            Profanity. Replaced with bullets; rejected in low-trust pools. One per line.
          </p>
          <Textarea
            id="rules-masked"
            aria-describedby="rules-masked-hint"
            rows={12}
            value={masked}
            onChange={(event) => setMasked(event.target.value)}
            className="font-mono text-xs"
          />
        </div>
      </div>

      <fieldset className="flex flex-col gap-3">
        <legend className="mb-2 text-sm font-medium">Remove from messages</legend>
        {flag("removeLinks", "Links")}
        {flag("removePhoneNumbers", "Phone numbers")}
        {flag("removeSocialHandles", "Emails and social media handles")}
      </fieldset>

      <fieldset className="flex flex-wrap gap-4">
        <legend className="mb-2 text-sm font-medium">Repeat spam</legend>
        <div className="flex flex-col gap-2">
          <Label htmlFor="rules-repeats">Same message allowed</Label>
          <Input
            id="rules-repeats"
            type="number"
            min={2}
            max={20}
            value={maxRepeats}
            onChange={(event) => setMaxRepeats(event.target.value)}
            className="w-28"
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="rules-window">Within (seconds)</Label>
          <Input
            id="rules-window"
            type="number"
            min={5}
            max={600}
            value={repeatWindow}
            onChange={(event) => setRepeatWindow(event.target.value)}
            className="w-28"
          />
        </div>
      </fieldset>

      {save.isError ? (
        <p role="alert" className="text-sm text-destructive">
          {errorMessage(save.error)}
        </p>
      ) : null}
      {save.isSuccess ? (
        <p role="status" className="text-sm text-muted-foreground">
          Saved. Every server uses the new rules within 30 seconds.
        </p>
      ) : null}
      <Button type="submit" className="self-start" disabled={save.isPending}>
        {save.isPending ? "Saving" : "Save rules"}
      </Button>
    </form>
  );
}

export function RulesEditor() {
  const query = useQuery({
    queryKey: rulesKey,
    queryFn: ({ signal }) => adminRepository.textRules(signal),
  });
  return (
    <>
      <PageHeader
        title="Word lists and rules"
        description="Text moderation for every chat. Changes are audit-logged."
      />
      <QueryView query={query} skeletonRows={6}>
        {(rules) => <RulesForm initial={rules} />}
      </QueryView>
    </>
  );
}
