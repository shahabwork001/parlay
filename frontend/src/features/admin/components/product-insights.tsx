"use client";
import { useQuery } from "@tanstack/react-query";
import { mvpRepository } from "@/repositories/mvp-repository";
import { errorMessage } from "@/lib/http/error-messages";
import { Stat } from "./admin-ui";
export function ProductInsights() {
  const query = useQuery({
    queryKey: ["admin", "product-metrics"],
    queryFn: mvpRepository.metrics,
    refetchInterval: 30_000,
  });
  if (query.isPending) return <p>Loading product metrics�</p>;
  if (query.error) return <p role="alert">{errorMessage(query.error)}</p>;
  const data = query.data;
  const seconds = (ms: number | null) => (ms === null ? "�" : `${(ms / 1000).toFixed(1)}s`);
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-lg font-medium">MVP validation</h2>
      <p className="text-xs text-muted-foreground">
        UTC day {data.day}. p95 uses the latest 2,000 waits. RTC setup outcomes are client-reported;
        missing reports are excluded. Repeat visitors returned on another day within 90 days.
      </p>
      <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Registered accounts" value={data.registeredUsers} />
        <Stat label="Active today" value={data.activeToday} />
        <Stat label="Repeat visitors today" value={data.repeatVisitors} />
        <Stat label="Match attempts today" value={data.matchAttempts} />
        <Stat label="Matches today" value={data.successfulMatches} />
        <Stat label="Average matching wait" value={seconds(data.averageWaitMs)} />
        <Stat label="Sampled p95 wait" value={seconds(data.sampledP95WaitMs)} />
        <Stat label="Average ended session" value={seconds(data.averageSessionMs)} />
        <Stat
          label="RTC setup failure rate"
          value={data.rtcFailureRate === null ? "�" : `${(data.rtcFailureRate * 100).toFixed(1)}%`}
          hint={`${data.rtcReports} reports today`}
        />
        <Stat label="Plus waitlist" value={data.waitlistSignups} />
        <Stat
          label="Plus preview visitors"
          value={data.premiumPreviewVisitors}
          hint="Authenticated visitors, last 90 days"
        />
        <Stat
          label="Waitlist conversion"
          value={
            data.waitlistConversion === null
              ? "�"
              : `${(data.waitlistConversion * 100).toFixed(1)}%`
          }
          hint="Active signups / authenticated previews (90 days)"
        />
      </dl>
    </section>
  );
}
