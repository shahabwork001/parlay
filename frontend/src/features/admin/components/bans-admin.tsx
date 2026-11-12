"use client";

import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { errorMessage } from "@/lib/http/error-messages";
import { adminRepository, type AdminBan } from "@/repositories/admin-repository";
import {
  BAN_REASON_LABELS,
  banDuration,
  banStatus,
  formatDateTime,
  formatRelative,
} from "../format";
import { Mono, PageHeader, Pagination, QueryView, Segmented } from "./admin-ui";
import { useAdminPermissions } from "./admin-shell";
import { pageFrom, useUrlState } from "../hooks/use-url-state";

type Filter = "active" | "appeals" | "all";

const FILTERS = [
  { value: "appeals", label: "Pending appeals" },
  { value: "active", label: "Active" },
  { value: "all", label: "All" },
] as const;

export const bansQueryKey = ["admin", "bans"] as const;

const BAN_DEFAULTS = { filter: "appeals", page: "1" };

function BanCard({ ban }: { ban: AdminBan }) {
  const queryClient = useQueryClient();
  const permissions = useAdminPermissions();
  const refresh = () => queryClient.invalidateQueries({ queryKey: ["admin"] });
  const lift = useMutation({
    mutationFn: () => adminRepository.liftBan(ban.id),
    onSuccess: refresh,
  });
  const appeal = useMutation({
    mutationFn: (accept: boolean) => adminRepository.decideAppeal(ban.id, accept),
    onSuccess: refresh,
  });
  const status = banStatus(ban);
  const error = lift.error ?? appeal.error;

  return (
    <li className="flex flex-col gap-3 rounded-lg border p-4 text-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-medium">{BAN_REASON_LABELS[ban.reason]}</span>
          <Badge variant={ban.mode === "shadow" ? "secondary" : "outline"}>
            {ban.mode === "shadow" ? "Shadow" : "Full"}
          </Badge>
          <Badge variant={status === "active" ? "destructive" : "outline"}>{status}</Badge>
        </div>
        <span className="text-xs text-muted-foreground">
          {ban.source === "automatic" ? "Automatic" : "Moderator"} · {formatRelative(ban.createdAt)}
        </span>
      </div>
      <p className="text-muted-foreground">
        {banDuration(ban)}
        {ban.message ? ` · “${ban.message}”` : ""}
      </p>
      <p className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
        Applies to
        {ban.targets.map((target) => (
          <span key={`${target.kind}:${target.value}`} className="inline-flex items-center gap-1">
            {target.kind} <Mono value={target.value} />
          </span>
        ))}
      </p>

      {ban.appeal ? (
        <div className="flex flex-col gap-2 rounded-md bg-muted p-3">
          <p className="text-xs text-muted-foreground">
            Appeal {ban.appeal.status} · sent {formatDateTime(ban.appeal.submittedAt)}
          </p>
          <p className="whitespace-pre-wrap">{ban.appeal.message}</p>
          {ban.appeal.status === "pending" && permissions.has("appeals.review") ? (
            <div className="flex flex-wrap gap-2">
              <Button size="sm" disabled={appeal.isPending} onClick={() => appeal.mutate(true)}>
                Accept and lift
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={appeal.isPending}
                onClick={() => appeal.mutate(false)}
              >
                Reject
              </Button>
            </div>
          ) : null}
        </div>
      ) : null}

      {status === "active" && permissions.has("bans.manage") ? (
        <Button
          size="sm"
          variant="outline"
          className="self-start"
          disabled={lift.isPending}
          onClick={() => lift.mutate()}
        >
          {lift.isPending ? "Lifting" : "Lift ban"}
        </Button>
      ) : null}
      {error ? (
        <p role="alert" className="text-destructive">
          {errorMessage(error)}
        </p>
      ) : null}
    </li>
  );
}

/** A list of bans with lift and appeal actions; `target` narrows it to one account or device. */
export function BanList({
  filter,
  target,
  page: controlledPage,
  onPage,
}: {
  filter: Filter;
  target?: string;
  /** Pass both to control paging (e.g. from the URL); otherwise the list pages on its own. */
  page?: number;
  onPage?: (page: number) => void;
}) {
  const [localPage, setLocalPage] = useState(1);
  const page = controlledPage ?? localPage;
  const setPage = onPage ?? setLocalPage;
  const query = useQuery({
    queryKey: [...bansQueryKey, filter, target, page],
    queryFn: ({ signal }) =>
      adminRepository.listBans({ filter, page, ...(target ? { target } : {}) }, signal),
    placeholderData: keepPreviousData,
  });
  return (
    <QueryView
      query={query}
      empty={filter === "appeals" ? "No appeals are waiting." : "No bans."}
      isEmpty={(data) => data.items.length === 0}
    >
      {(data) => (
        <div className="flex flex-col gap-3">
          <ul className="flex flex-col gap-3">
            {data.items.map((ban) => (
              <BanCard key={ban.id} ban={ban} />
            ))}
          </ul>
          <Pagination page={data.page} totalPages={data.totalPages} onPage={setPage} />
        </div>
      )}
    </QueryView>
  );
}

export function BansAdmin() {
  const [url, setUrl] = useUrlState(BAN_DEFAULTS);
  const filter = url.filter as Filter;
  return (
    <>
      <PageHeader
        title="Bans and appeals"
        description="Accepting an appeal lifts the ban. Shadow bans are invisible to the person and cannot be appealed."
        actions={
          <Segmented
            label="Show"
            value={filter}
            options={FILTERS}
            onChange={(value) => setUrl({ filter: value, page: "1" })}
          />
        }
      />
      <BanList
        filter={filter}
        page={pageFrom(url.page)}
        onPage={(next) => setUrl({ page: String(next) })}
      />
    </>
  );
}
