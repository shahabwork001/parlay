"use client";

import type { UseQueryResult } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { errorMessage } from "@/lib/http/error-messages";
import { cn } from "@/lib/utils";
import type { Tier } from "@/repositories/admin-repository";
import { shortId, TIER_LABELS } from "../format";

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
        {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
      </div>
      {actions}
    </div>
  );
}

/** Loading, error (with retry) and empty states for any admin query; renders children with data. */
export function QueryView<T>({
  query,
  empty,
  isEmpty,
  children,
  skeletonRows = 4,
}: {
  query: UseQueryResult<T>;
  empty?: string;
  isEmpty?: (data: T) => boolean;
  children: (data: T) => ReactNode;
  skeletonRows?: number;
}) {
  if (query.isPending) {
    return (
      <div className="flex flex-col gap-2" aria-busy="true" aria-label="Loading">
        {Array.from({ length: skeletonRows }, (_, index) => (
          <Skeleton key={index} className="h-10 w-full" />
        ))}
      </div>
    );
  }
  if (query.isError) {
    return (
      <div className="flex flex-col items-start gap-3 rounded-lg border p-4">
        <p role="alert" className="text-sm text-destructive">
          {errorMessage(query.error)}
        </p>
        <Button variant="outline" size="sm" onClick={() => void query.refetch()}>
          Try again
        </Button>
      </div>
    );
  }
  if (empty && isEmpty?.(query.data)) {
    return (
      <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
        {empty}
      </p>
    );
  }
  return <>{children(query.data)}</>;
}

export function Pagination({
  page,
  totalPages,
  onPage,
}: {
  page: number;
  totalPages: number;
  onPage: (page: number) => void;
}) {
  if (totalPages <= 1) return null;
  return (
    <nav aria-label="Pages" className="flex items-center justify-end gap-2 text-sm">
      <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => onPage(page - 1)}>
        Previous
      </Button>
      <span className="text-muted-foreground">
        Page {page} of {totalPages}
      </span>
      <Button
        variant="outline"
        size="sm"
        disabled={page >= totalPages}
        onClick={() => onPage(page + 1)}
      >
        Next
      </Button>
    </nav>
  );
}

const TIER_STYLES: Record<Tier, string> = {
  critical: "bg-destructive text-white",
  high: "bg-destructive/10 text-destructive",
  normal: "bg-secondary text-secondary-foreground",
  low: "border-border text-muted-foreground",
};

export function TierBadge({ tier }: { tier: Tier }) {
  return <Badge className={TIER_STYLES[tier]}>{TIER_LABELS[tier]}</Badge>;
}

/** Segmented control for filters: a group of toggle buttons, the current one pressed. */
export function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: readonly { value: T; label: string }[];
  onChange: (value: T) => void;
}) {
  return (
    <div role="group" aria-label={label} className="inline-flex flex-wrap rounded-lg border p-0.5">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          aria-pressed={option.value === value}
          onClick={() => onChange(option.value)}
          className={cn(
            "rounded-md px-3 py-1.5 text-sm transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
            option.value === value
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

export function Mono({ value }: { value: string }) {
  return (
    <code title={value} className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">
      {shortId(value)}
    </code>
  );
}

/** Bars for a numeric series (oldest first). Values are also listed for screen readers. */
export function BarChart({
  label,
  values,
  unit,
}: {
  label: string;
  values: readonly number[];
  unit: string;
}) {
  const max = Math.max(1, ...values);
  const total = values.reduce((sum, value) => sum + value, 0);
  return (
    <figure className="flex flex-col gap-2">
      <figcaption className="flex items-baseline justify-between text-sm">
        <span className="font-medium">{label}</span>
        <span className="text-muted-foreground">
          {total} {unit}
        </span>
      </figcaption>
      <svg
        viewBox={`0 0 ${values.length * 4} 40`}
        preserveAspectRatio="none"
        className="h-24 w-full"
        aria-hidden
      >
        {values.map((value, index) => {
          const height = (value / max) * 38;
          return (
            <rect
              key={index}
              x={index * 4 + 0.5}
              y={40 - height}
              width={3}
              height={Math.max(height, value > 0 ? 1 : 0.3)}
              className={value > 0 ? "fill-primary" : "fill-muted"}
            />
          );
        })}
      </svg>
      <p className="sr-only">{values.join(", ")}</p>
    </figure>
  );
}

/** One figure of a stats grid; render inside a <dl>. */
export function Stat({ label, value, hint }: { label: string; value: ReactNode; hint?: string }) {
  return (
    <div className="flex flex-col gap-1 rounded-xl border p-4">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="flex flex-col gap-1">
        <span className="text-2xl font-semibold tracking-tight tabular-nums">{value}</span>
        {hint ? <span className="text-xs text-muted-foreground">{hint}</span> : null}
      </dd>
    </div>
  );
}
