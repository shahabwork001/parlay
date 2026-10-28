"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { siteConfigQueryKey } from "@/features/site/hooks/use-site-config";
import { errorMessage } from "@/lib/http/error-messages";
import {
  type AdminSiteConfig,
  type SiteConfig,
  siteRepository,
} from "@/repositories/site-repository";
import { formatDateTime } from "../format";
import { PageHeader, QueryView } from "./admin-ui";

const adminKey = ["admin", "site"] as const;

const FLAGS: readonly { key: keyof SiteConfig["features"]; label: string; hint: string }[] = [
  { key: "videoChat", label: "Video chat", hint: "Off: nobody can start a video chat." },
  { key: "textChat", label: "Text chat", hint: "Off: nobody can start a text chat." },
  {
    key: "registration",
    label: "New accounts",
    hint: "Off: sign-up is closed; chatting without an account still works.",
  },
];

function Toggle({
  id,
  label,
  hint,
  checked,
  onChange,
}: {
  id: string;
  label: string;
  hint: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <Label htmlFor={id} className="flex flex-col items-start gap-0.5 font-normal">
        <span className="font-medium">{label}</span>
        <span className="text-xs text-muted-foreground">{hint}</span>
      </Label>
      <Switch id={id} checked={checked} onCheckedChange={onChange} />
    </div>
  );
}

function SiteForm({ initial }: { initial: AdminSiteConfig }) {
  const queryClient = useQueryClient();
  const [maintenance, setMaintenance] = useState(initial.maintenance.enabled);
  const [maintenanceText, setMaintenanceText] = useState(initial.maintenance.message ?? "");
  const [announcementText, setAnnouncementText] = useState(initial.announcement?.message ?? "");
  const [tone, setTone] = useState(initial.announcement?.tone ?? "info");
  const [features, setFeatures] = useState(initial.features);

  const save = useMutation({
    mutationFn: () =>
      siteRepository.save({
        maintenance: { enabled: maintenance, message: maintenanceText.trim() || null },
        announcement: announcementText.trim() ? { message: announcementText.trim(), tone } : null,
        features,
      }),
    onSuccess: async (saved) => {
      queryClient.setQueryData(adminKey, saved);
      await queryClient.invalidateQueries({ queryKey: siteConfigQueryKey });
    },
  });

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        save.mutate();
      }}
      className="flex max-w-2xl flex-col gap-8"
    >
      <section
        aria-labelledby="maintenance-heading"
        className="flex flex-col gap-4 rounded-xl border p-5"
      >
        <h2 id="maintenance-heading" className="text-sm font-medium">
          Maintenance mode
        </h2>
        <Toggle
          id="site-maintenance"
          label="Pause all chats"
          hint="New chats are refused and new connections turned away; staff can still connect. Chats in progress continue until they end."
          checked={maintenance}
          onChange={setMaintenance}
        />
        <div className="flex flex-col gap-2">
          <Label htmlFor="site-maintenance-message">Message (optional)</Label>
          <Textarea
            id="site-maintenance-message"
            rows={2}
            maxLength={280}
            placeholder="Parley is down for maintenance. Please check back soon."
            value={maintenanceText}
            onChange={(event) => setMaintenanceText(event.target.value)}
          />
        </div>
      </section>

      <section
        aria-labelledby="announcement-heading"
        className="flex flex-col gap-4 rounded-xl border p-5"
      >
        <h2 id="announcement-heading" className="text-sm font-medium">
          Announcement
        </h2>
        <div className="flex flex-col gap-2">
          <Label htmlFor="site-announcement">Banner text (leave empty for none)</Label>
          <Textarea
            id="site-announcement"
            rows={2}
            maxLength={280}
            value={announcementText}
            onChange={(event) => setAnnouncementText(event.target.value)}
          />
        </div>
        <RadioGroup
          value={tone}
          onValueChange={(value) => setTone(value as "info" | "warning")}
          className="flex gap-6"
        >
          <Label htmlFor="tone-info" className="flex items-center gap-2 font-normal">
            <RadioGroupItem id="tone-info" value="info" />
            Information
          </Label>
          <Label htmlFor="tone-warning" className="flex items-center gap-2 font-normal">
            <RadioGroupItem id="tone-warning" value="warning" />
            Important
          </Label>
        </RadioGroup>
      </section>

      <section
        aria-labelledby="features-heading"
        className="flex flex-col gap-4 rounded-xl border p-5"
      >
        <h2 id="features-heading" className="text-sm font-medium">
          Features
        </h2>
        {FLAGS.map((flag) => (
          <Toggle
            key={flag.key}
            id={`site-flag-${flag.key}`}
            label={flag.label}
            hint={flag.hint}
            checked={features[flag.key]}
            onChange={(checked) => setFeatures((current) => ({ ...current, [flag.key]: checked }))}
          />
        ))}
      </section>

      {save.isError ? (
        <p role="alert" className="text-sm text-destructive">
          {errorMessage(save.error)}
        </p>
      ) : null}
      {save.isSuccess ? (
        <p role="status" className="text-sm text-muted-foreground">
          Saved. Every server applies the change within 15 seconds.
        </p>
      ) : null}
      <div className="flex flex-wrap items-center gap-4">
        <Button type="submit" disabled={save.isPending}>
          {save.isPending ? "Saving" : "Save settings"}
        </Button>
        {initial.updatedAt ? (
          <span className="text-xs text-muted-foreground">
            Last changed {formatDateTime(initial.updatedAt)}
          </span>
        ) : null}
      </div>
    </form>
  );
}

export function SiteSettings() {
  const query = useQuery({
    queryKey: adminKey,
    queryFn: ({ signal }) => siteRepository.adminCurrent(signal),
  });
  return (
    <>
      <PageHeader
        title="Site settings"
        description="Maintenance mode, the announcement banner and which features are on. Changes are audit-logged."
      />
      <QueryView query={query} skeletonRows={5}>
        {(config) => <SiteForm initial={config} />}
      </QueryView>
    </>
  );
}
