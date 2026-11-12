"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useState } from "react";
import { Kbd } from "@/components/shared/kbd";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Skeleton } from "@/components/ui/skeleton";
import { errorMessage } from "@/lib/http/error-messages";
import { categoryLabel } from "@/lib/report-categories";
import {
  adminRepository,
  type ReportDecision,
  type ReportDetail,
} from "@/repositories/admin-repository";
import { BAN_REASON_LABELS, banDuration, formatDateTime, formatRelative } from "../format";
import { useShortcuts } from "../hooks/use-shortcuts";
import { Mono, QueryView, TierBadge } from "./admin-ui";
import { useAdminPermissions } from "./admin-shell";
import { BanDialog } from "./ban-dialog";

export const reportQueryKey = (id: string) => ["admin", "report", id] as const;

const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? "" : "s"}`;

const MINOR_SAFETY = new Set(["appears-minor", "child-sexual-content"]);

function Evidence({ reportId }: { reportId: string }) {
  const [requested, setRequested] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const query = useQuery({
    queryKey: ["admin", "evidence", reportId],
    queryFn: ({ signal }) => adminRepository.evidence(reportId, signal),
    enabled: requested,
    staleTime: Infinity,
  });

  if (!requested) {
    return (
      <div className="flex flex-col items-start gap-2">
        <p className="text-sm text-muted-foreground">
          Opening the evidence is recorded in the audit log.
        </p>
        <Button variant="outline" size="sm" onClick={() => setRequested(true)}>
          View evidence
        </Button>
      </div>
    );
  }

  return (
    <QueryView query={query} skeletonRows={2}>
      {(evidence) => (
        <div className="flex flex-col gap-4">
          {evidence.snapshot ? (
            <div className="flex flex-col items-start gap-2">
              <div className="relative overflow-hidden rounded-lg border">
                {/* A data URL from the API; next/image adds nothing for an inline, private still. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={evidence.snapshot}
                  alt="Still from the reported person's video"
                  className={revealed ? "max-h-72" : "max-h-72 blur-2xl"}
                />
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setRevealed((value) => !value)}
                aria-pressed={revealed}
              >
                {revealed ? "Blur image" : "Reveal image"}
              </Button>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              No image (text chat or no video at the time).
            </p>
          )}
          {evidence.messages.length > 0 ? (
            <ol
              aria-label="Last messages"
              className="flex flex-col gap-1.5 rounded-lg border p-3 text-sm"
            >
              {evidence.messages.map((message, index) => (
                <li key={index} className="flex gap-2">
                  <span
                    className={
                      message.from === "reported" ? "font-medium text-destructive" : "font-medium"
                    }
                  >
                    {message.from === "reported" ? "Reported" : "Reporter"}:
                  </span>
                  <span className="break-words">{message.text}</span>
                </li>
              ))}
            </ol>
          ) : (
            <p className="text-sm text-muted-foreground">No messages were exchanged.</p>
          )}
          <p className="text-xs text-muted-foreground">
            Evidence is deleted {formatRelative(evidence.expiresAt)}.
          </p>
        </div>
      )}
    </QueryView>
  );
}

function Party({
  title,
  party,
  trust,
  facts,
}: {
  title: string;
  party: ReportDetail["report"]["reporter"];
  trust: number;
  facts: string;
}) {
  return (
    <section aria-label={title} className="flex flex-col gap-1.5 rounded-lg border p-3 text-sm">
      <h3 className="font-medium">{title}</h3>
      <p className="text-muted-foreground">
        {party.kind === "user" ? "Account" : "Anonymous"} · trust {trust}
        {trust < 25 ? " (low)" : ""}
      </p>
      <p className="text-muted-foreground">{facts}</p>
      <p className="flex flex-wrap items-center gap-1.5 text-xs">
        {party.kind === "user" ? (
          <Link href={`/admin/users/${party.subjectId}`} className="underline underline-offset-4">
            Open account
          </Link>
        ) : (
          <>
            Device <Mono value={party.deviceId} />
          </>
        )}
      </p>
    </section>
  );
}

function Escalation({ detail }: { detail: ReportDetail }) {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<"reported" | "not-required">("reported");
  const [reference, setReference] = useState("");
  const record = useMutation({
    mutationFn: () =>
      adminRepository.recordEscalation(detail.report.id, {
        status,
        ...(status === "reported" ? { reference } : {}),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: reportQueryKey(detail.report.id) }),
  });

  if (detail.report.escalation !== "required") {
    return (
      <p className="text-sm text-muted-foreground">
        Escalation:{" "}
        {detail.report.escalation === "reported"
          ? `reported to the authority (reference ${detail.report.escalationReference ?? "not given"}).`
          : "not required."}
      </p>
    );
  }

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        record.mutate();
      }}
      className="flex flex-col gap-3 rounded-lg border border-destructive/40 p-4"
    >
      <h3 className="text-sm font-medium">Escalation</h3>
      <p className="text-sm text-muted-foreground">
        If the evidence shows sexual content involving a minor, report it to the NCMEC CyberTipline
        (or your national hotline) and record the reference here. See the minor-safety workflow.
      </p>
      <RadioGroup
        value={status}
        onValueChange={(value) => setStatus(value as "reported" | "not-required")}
      >
        <Label htmlFor="escalation-reported" className="flex items-center gap-2 font-normal">
          <RadioGroupItem id="escalation-reported" value="reported" />
          Reported to the authority
        </Label>
        <Label htmlFor="escalation-not-required" className="flex items-center gap-2 font-normal">
          <RadioGroupItem id="escalation-not-required" value="not-required" />
          Not required
        </Label>
      </RadioGroup>
      {status === "reported" ? (
        <div className="flex flex-col gap-2">
          <Label htmlFor="escalation-reference">Reference number</Label>
          <Input
            id="escalation-reference"
            value={reference}
            maxLength={100}
            onChange={(event) => setReference(event.target.value)}
          />
        </div>
      ) : null}
      {record.isError ? (
        <p role="alert" className="text-sm text-destructive">
          {errorMessage(record.error)}
        </p>
      ) : null}
      <Button type="submit" size="sm" className="self-start" disabled={record.isPending}>
        {record.isPending ? "Saving" : "Save escalation"}
      </Button>
    </form>
  );
}

function Decision({ detail, onDecided }: { detail: ReportDetail; onDecided: () => void }) {
  const queryClient = useQueryClient();
  const permissions = useAdminPermissions();
  const [banOpen, setBanOpen] = useState(false);
  const report = detail.report;
  const minorSafety = MINOR_SAFETY.has(report.category);
  const canAct =
    permissions.has("moderation.act") && (!minorSafety || permissions.has("moderation.escalate"));

  const decide = useMutation({
    mutationFn: (decision: ReportDecision) => adminRepository.decide(report.id, decision),
    onSuccess: async () => {
      setBanOpen(false);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: reportQueryKey(report.id) }),
        queryClient.invalidateQueries({ queryKey: ["admin", "reports"] }),
        queryClient.invalidateQueries({ queryKey: ["admin", "dashboard"] }),
      ]);
      onDecided();
    },
  });

  const open = report.status === "pending-review";
  useShortcuts(
    {
      d: () => decide.mutate({ action: "dismiss" }),
      w: () => decide.mutate({ action: "warn" }),
      b: () => setBanOpen(true),
    },
    open && canAct && !decide.isPending,
  );

  if (!open) {
    return (
      <Alert>
        <AlertDescription>
          Decided {report.resolution ? formatRelative(report.resolution.at) : ""}:{" "}
          <strong>{report.resolution?.outcome}</strong>
          {report.resolution?.note ? ` (${report.resolution.note})` : ""}.
        </AlertDescription>
      </Alert>
    );
  }
  if (!canAct) {
    return (
      <p className="text-sm text-muted-foreground">
        Your role can review this report but not decide it.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div role="toolbar" aria-label="Decision" className="flex flex-wrap gap-2">
        <Button
          variant="outline"
          disabled={decide.isPending}
          onClick={() => decide.mutate({ action: "dismiss" })}
        >
          Dismiss <Kbd>D</Kbd>
        </Button>
        <Button
          variant="outline"
          disabled={decide.isPending}
          onClick={() => decide.mutate({ action: "warn" })}
        >
          Warn <Kbd>W</Kbd>
        </Button>
        <Button variant="destructive" disabled={decide.isPending} onClick={() => setBanOpen(true)}>
          Ban <Kbd>B</Kbd>
        </Button>
      </div>
      {decide.isError ? (
        <p role="alert" className="text-sm text-destructive">
          {errorMessage(decide.error)}
        </p>
      ) : null}
      <BanDialog
        open={banOpen}
        onOpenChange={setBanOpen}
        pending={decide.isPending}
        defaultPermanent={minorSafety}
        onConfirm={(choice) => decide.mutate({ action: "ban", ...choice })}
      />
    </div>
  );
}

/** One report: what happened, who was involved, the evidence and the decision. */
export function ReportReview({ reportId, onDecided }: { reportId: string; onDecided: () => void }) {
  const permissions = useAdminPermissions();
  const query = useQuery({
    queryKey: reportQueryKey(reportId),
    queryFn: ({ signal }) => adminRepository.report(reportId, signal),
  });

  if (query.isPending) return <Skeleton className="h-96 w-full" aria-label="Loading report" />;

  return (
    <QueryView query={query}>
      {(detail) => {
        const { report } = detail;
        const minorSafety = MINOR_SAFETY.has(report.category);
        return (
          <article aria-labelledby="report-title" className="flex flex-col gap-5">
            <header className="flex flex-col gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <TierBadge tier={report.tier} />
                <Badge variant="outline">{report.mode === "video" ? "Video" : "Text"}</Badge>
                <span className="text-xs text-muted-foreground">Priority {report.priority}</span>
              </div>
              <h2 id="report-title" className="text-lg font-semibold tracking-tight">
                {categoryLabel(report.category)}
              </h2>
              <p className="text-sm text-muted-foreground">
                Reported {formatDateTime(report.createdAt)} ({formatRelative(report.createdAt)})
              </p>
              {report.note ? (
                <p className="rounded-lg bg-muted p-3 text-sm">“{report.note}”</p>
              ) : null}
              {report.score && report.score.labels.length > 0 ? (
                <p className="text-xs text-muted-foreground">
                  Classifier: {report.score.labels.join(", ")}
                </p>
              ) : null}
            </header>

            {minorSafety ? (
              <Alert variant="destructive">
                <AlertDescription>
                  Minor-safety report. The reported person was suspended automatically. Follow the
                  minor-safety workflow; do not copy or share the evidence.
                </AlertDescription>
              </Alert>
            ) : null}

            <div className="grid gap-3 sm:grid-cols-2">
              <Party
                title="Reported person"
                party={report.reported}
                trust={detail.reportedTrust}
                facts={`${plural(detail.reportedHistory.total, "report")} (${detail.reportedHistory.upheld} upheld, ${detail.reportedHistory.lastDay} today)`}
              />
              <Party
                title="Reporter"
                party={report.reporter}
                trust={detail.reporterTrust}
                facts={`${plural(detail.reporterHistory.total, "report")} filed, ${detail.reporterHistory.dismissed} dismissed`}
              />
            </div>

            {detail.activeBans.length > 0 ? (
              <section aria-label="Active bans" className="flex flex-col gap-1 text-sm">
                <h3 className="font-medium">Active bans</h3>
                <ul className="flex flex-col gap-1 text-muted-foreground">
                  {detail.activeBans.map((ban) => (
                    <li key={ban.id}>
                      {BAN_REASON_LABELS[ban.reason]}, {ban.mode} ban,{" "}
                      {banDuration(ban).toLowerCase()}
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}

            <section aria-label="Evidence" className="flex flex-col gap-2">
              <h3 className="text-sm font-medium">Evidence</h3>
              {!report.hasEvidence ? (
                <p className="text-sm text-muted-foreground">No evidence was attached.</p>
              ) : minorSafety && !permissions.has("moderation.escalate") ? (
                <p className="text-sm text-muted-foreground">
                  Restricted to staff who can escalate.
                </p>
              ) : (
                <Evidence reportId={report.id} />
              )}
            </section>

            {minorSafety && permissions.has("moderation.escalate") ? (
              <Escalation detail={detail} />
            ) : null}

            <Decision detail={detail} onDecided={onDecided} />
          </article>
        );
      }}
    </QueryView>
  );
}
