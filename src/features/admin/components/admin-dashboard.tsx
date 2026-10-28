"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { adminRepository } from "@/repositories/admin-repository";
import { formatRelative, formatWait } from "../format";
import { BarChart, PageHeader, QueryView, Stat } from "./admin-ui";

const REFRESH_MS = 10_000;

export function AdminDashboard() {
  const query = useQuery({
    queryKey: ["admin", "dashboard"],
    queryFn: ({ signal }) => adminRepository.dashboard(signal),
    refetchInterval: REFRESH_MS,
  });

  return (
    <>
      <PageHeader title="Dashboard" description="Live numbers refresh every 10 seconds." />
      <QueryView query={query} skeletonRows={6}>
        {(data) => {
          const reportsToday = data.reportsPerHour.reduce((sum, value) => sum + value, 0);
          const openTotal = Object.values(data.openReports).reduce((sum, value) => sum + value, 0);
          const lastMinuteMatches = data.matchesPerMinute.at(-1) ?? 0;
          return (
            <div className="flex flex-col gap-6">
              <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                <Stat label="Online now" value={data.online} />
                <Stat
                  label="Waiting for a match"
                  value={data.waiting.text + data.waiting.video}
                  hint={`${data.waiting.text} text, ${data.waiting.video} video`}
                />
                <Stat label="Active chats" value={data.activeSessions} />
                <Stat
                  label="Average wait"
                  value={formatWait(data.averageWaitMs)}
                  hint="Last 15 minutes"
                />
                <Stat label="Matches this minute" value={lastMinuteMatches} />
                <Stat label="Reports, last 24 h" value={reportsToday} />
                <Stat
                  label="Open reports"
                  value={openTotal}
                  hint={`${data.openReports.critical ?? 0} critical, ${data.openReports.high ?? 0} high`}
                />
                <Stat label="Pending appeals" value={data.pendingAppeals} />
              </dl>

              <div className="grid gap-6 rounded-xl border p-5 lg:grid-cols-2">
                <BarChart
                  label="Matches per minute, last hour"
                  values={data.matchesPerMinute}
                  unit="matches"
                />
                <BarChart
                  label="Reports per hour, last 24 hours"
                  values={data.reportsPerHour}
                  unit="reports"
                />
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground">
                <p>Updated {formatRelative(data.generatedAt)}.</p>
                {openTotal > 0 ? (
                  <Link
                    href="/admin/reports"
                    className="font-medium text-foreground underline underline-offset-4"
                  >
                    Review open reports
                  </Link>
                ) : null}
              </div>
            </div>
          );
        }}
      </QueryView>
    </>
  );
}
