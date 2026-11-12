"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Kbd } from "@/components/shared/kbd";
import { Button } from "@/components/ui/button";
import { categoryLabel } from "@/lib/report-categories";
import { cn } from "@/lib/utils";
import { adminRepository, type Tier } from "@/repositories/admin-repository";
import { formatRelative, TIER_LABELS } from "../format";
import { useShortcuts } from "../hooks/use-shortcuts";
import { pageFrom, useUrlState } from "../hooks/use-url-state";
import { PageHeader, Pagination, QueryView, Segmented, TierBadge } from "./admin-ui";
import { ReportReview } from "./report-review";

type Status = "open" | "resolved" | "all";
type Order = "priority" | "newest" | "oldest";

const DEFAULTS = { status: "open", tier: "any", sort: "priority", page: "1" };

const ORDER_OPTIONS = [
  { value: "priority", label: "Most urgent" },
  { value: "oldest", label: "Oldest" },
  { value: "newest", label: "Newest" },
] as const;

const STATUS_OPTIONS = [
  { value: "open", label: "Open" },
  { value: "resolved", label: "Decided" },
  { value: "all", label: "All" },
] as const;

const TIER_OPTIONS = [
  { value: "any", label: "Any priority" },
  ...(Object.keys(TIER_LABELS) as Tier[]).map((tier) => ({
    value: tier,
    label: TIER_LABELS[tier],
  })),
] as const;

/** The review queue: open reports by priority (oldest first within a priority), with a review pane. */
export function ReportQueue() {
  const [url, setUrl] = useUrlState(DEFAULTS);
  const status = url.status as Status;
  const tier = url.tier as Tier | "any";
  const sort = url.sort as Order;
  const page = pageFrom(url.page);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const query = useQuery({
    queryKey: ["admin", "reports", status, tier, sort, page],
    queryFn: ({ signal }) =>
      adminRepository.listReports(
        { status, sort, page, ...(tier === "any" ? {} : { tier }) },
        signal,
      ),
    placeholderData: keepPreviousData,
    refetchInterval: 15_000,
  });
  const items = query.data?.items ?? [];
  const selectedIndex = items.findIndex((item) => item.id === selectedId);
  const current = selectedIndex >= 0 ? items[selectedIndex] : items[0];

  const move = (offset: number) => {
    if (items.length === 0) return;
    const index = Math.min(
      items.length - 1,
      Math.max(0, (selectedIndex < 0 ? 0 : selectedIndex) + offset),
    );
    setSelectedId(items[index]?.id ?? null);
  };
  useShortcuts({ j: () => move(1), k: () => move(-1) });

  const filtersChanged = (patch: Partial<typeof DEFAULTS>) => {
    setUrl({ ...patch, page: "1" });
    setSelectedId(null);
  };

  return (
    <>
      <PageHeader
        title="Moderation queue"
        description="Most urgent first. J and K move through the list; D dismisses, W warns, B bans."
        actions={
          <div className="flex flex-wrap gap-2">
            <Segmented
              label="Status"
              value={status}
              options={STATUS_OPTIONS}
              onChange={(value) => filtersChanged({ status: value })}
            />
            <Segmented
              label="Priority"
              value={tier}
              options={TIER_OPTIONS}
              onChange={(value) => filtersChanged({ tier: value })}
            />
            <Segmented
              label="Order"
              value={sort}
              options={ORDER_OPTIONS}
              onChange={(value) => filtersChanged({ sort: value })}
            />
          </div>
        }
      />
      <QueryView
        query={query}
        empty={
          status === "open"
            ? "No open reports. The queue is clear."
            : "No reports match these filters."
        }
        isEmpty={(data) => data.items.length === 0}
      >
        {(data) => (
          <div className="grid gap-6 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]">
            <div
              className={cn(
                "flex flex-col gap-3",
                current && selectedId ? "hidden lg:flex" : "flex",
              )}
            >
              <ul aria-label="Reports" className="flex flex-col gap-1.5">
                {data.items.map((item) => {
                  const active = item.id === current?.id;
                  return (
                    <li key={item.id}>
                      <button
                        type="button"
                        aria-current={active ? "true" : undefined}
                        onClick={() => setSelectedId(item.id)}
                        className={cn(
                          "flex w-full flex-col gap-1 rounded-lg border p-3 text-left text-sm transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                          active ? "border-primary bg-muted" : "hover:bg-muted/60",
                        )}
                      >
                        <span className="flex items-center justify-between gap-2">
                          <span className="font-medium">{categoryLabel(item.category)}</span>
                          <TierBadge tier={item.tier} />
                        </span>
                        {item.notePreview ? (
                          <span className="line-clamp-1 text-xs">“{item.notePreview}”</span>
                        ) : null}
                        <span className="text-xs text-muted-foreground">
                          {item.mode === "video" ? "Video" : "Text"} ·{" "}
                          {formatRelative(item.createdAt)}
                          {item.outcome ? ` · ${item.outcome}` : ""}
                          {item.escalation === "required" ? " · escalation due" : ""}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
              <Pagination
                page={data.page}
                totalPages={data.totalPages}
                onPage={(next) => setUrl({ page: String(next) })}
              />
            </div>
            <div className={cn("min-w-0", current && selectedId ? "block" : "hidden lg:block")}>
              {selectedId ? (
                <Button
                  variant="ghost"
                  size="sm"
                  className="mb-3 lg:hidden"
                  onClick={() => setSelectedId(null)}
                >
                  Back to the list
                </Button>
              ) : null}
              {current ? (
                <ReportReview
                  key={current.id}
                  reportId={current.id}
                  onDecided={() => {
                    const next =
                      data.items[selectedIndex + 1] ??
                      data.items.find((item) => item.id !== current.id);
                    setSelectedId(status === "open" ? (next?.id ?? null) : current.id);
                  }}
                />
              ) : null}
              <p className="mt-6 hidden text-xs text-muted-foreground lg:block">
                <Kbd>J</Kbd> next · <Kbd>K</Kbd> previous · <Kbd>D</Kbd> dismiss · <Kbd>W</Kbd> warn
                · <Kbd>B</Kbd> ban
              </p>
            </div>
          </div>
        )}
      </QueryView>
    </>
  );
}
