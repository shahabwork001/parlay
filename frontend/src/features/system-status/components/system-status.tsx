"use client";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { type HealthStatus } from "@/repositories/system-repository";
import { useReadiness } from "../hooks/use-readiness";

const STATUS_LABELS: Record<HealthStatus, string> = {
  Healthy: "Operational",
  Degraded: "Degraded",
  Unhealthy: "Outage",
};

const STATUS_DOT: Record<HealthStatus, string> = {
  Healthy: "bg-emerald-500",
  Degraded: "bg-amber-500",
  Unhealthy: "bg-red-500",
};

const COMPONENT_LABELS: Record<string, string> = {
  mongodb: "Database",
  redis: "Realtime cache",
  rabbitmq: "Message queue",
};

function StatusDot({ status }: { status: HealthStatus }) {
  return <span aria-hidden className={cn("size-2 rounded-full", STATUS_DOT[status])} />;
}

export function SystemStatus() {
  const { data, isPending, isError, refetch, isRefetching } = useReadiness();

  if (isPending) {
    return (
      <div className="flex flex-col gap-3" aria-busy="true" aria-label="Loading status">
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  if (isError) {
    return (
      <div role="alert" className="flex flex-col items-start gap-3 rounded-xl border p-6">
        <p className="text-sm font-medium">The status service could not be reached.</p>
        <p className="text-sm text-muted-foreground">
          This usually means the API is down or your connection dropped.
        </p>
        <Button variant="outline" onClick={() => void refetch()} disabled={isRefetching}>
          {isRefetching ? "Retrying" : "Retry"}
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3 rounded-xl border p-5">
        <StatusDot status={data.status} />
        <p className="text-sm font-medium" aria-live="polite">
          {data.status === "Healthy" ? "All systems operational" : STATUS_LABELS[data.status]}
        </p>
      </div>
      <ul className="divide-y rounded-xl border">
        {data.checks.map((check) => (
          <li key={check.name} className="flex items-center justify-between gap-4 px-5 py-3.5">
            <span className="text-sm">{COMPONENT_LABELS[check.name] ?? check.name}</span>
            <span className="flex items-center gap-2 text-sm text-muted-foreground">
              <StatusDot status={check.status} />
              {STATUS_LABELS[check.status]}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
