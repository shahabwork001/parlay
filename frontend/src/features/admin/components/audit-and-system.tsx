"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { adminRepository, type SystemStatus } from "@/repositories/admin-repository";
import { formatDateTime, formatRelative } from "../format";
import { Mono, PageHeader, Pagination, QueryView } from "./admin-ui";

export function AuditLog() {
  const [inputs, setInputs] = useState({ action: "", targetId: "" });
  const [filter, setFilter] = useState(inputs);
  const [page, setPage] = useState(1);
  const query = useQuery({
    queryKey: ["admin", "audit", filter, page],
    queryFn: ({ signal }) => adminRepository.audit({ ...filter, page }, signal),
    placeholderData: keepPreviousData,
  });

  return (
    <>
      <PageHeader
        title="Audit log"
        description="Every staff action and automatic ban, newest first."
      />
      <form
        role="search"
        className="flex flex-wrap items-end gap-3"
        onSubmit={(event) => {
          event.preventDefault();
          setFilter(inputs);
          setPage(1);
        }}
      >
        <div className="flex flex-col gap-2">
          <Label htmlFor="audit-action">Action</Label>
          <Input
            id="audit-action"
            placeholder="e.g. report.decided"
            value={inputs.action}
            onChange={(event) => setInputs({ ...inputs, action: event.target.value })}
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="audit-target">Target id</Label>
          <Input
            id="audit-target"
            value={inputs.targetId}
            onChange={(event) => setInputs({ ...inputs, targetId: event.target.value })}
          />
        </div>
        <Button type="submit">Filter</Button>
      </form>
      <QueryView
        query={query}
        empty="No entries match."
        isEmpty={(data) => data.items.length === 0}
      >
        {(data) => (
          <div className="flex flex-col gap-3">
            <div className="overflow-x-auto rounded-lg border">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
                  <tr>
                    <th scope="col" className="px-3 py-2 font-medium">
                      When
                    </th>
                    <th scope="col" className="px-3 py-2 font-medium">
                      Who
                    </th>
                    <th scope="col" className="px-3 py-2 font-medium">
                      Action
                    </th>
                    <th scope="col" className="px-3 py-2 font-medium">
                      Target
                    </th>
                    <th scope="col" className="px-3 py-2 font-medium">
                      Details
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {data.items.map((entry) => (
                    <tr key={entry.id} className="border-t align-top">
                      <td
                        className="px-3 py-2 whitespace-nowrap text-muted-foreground"
                        title={formatDateTime(entry.at)}
                      >
                        {formatRelative(entry.at)}
                      </td>
                      <td className="px-3 py-2">
                        {entry.actor.kind === "system" ? (
                          <Badge variant="outline">System</Badge>
                        ) : entry.actor.subjectId ? (
                          <Mono value={entry.actor.subjectId} />
                        ) : (
                          "Staff"
                        )}
                      </td>
                      <td className="px-3 py-2 font-mono text-xs">{entry.action}</td>
                      <td className="px-3 py-2 whitespace-nowrap">
                        {entry.target.type} <Mono value={entry.target.id} />
                      </td>
                      <td className="px-3 py-2 text-xs text-muted-foreground">
                        {Object.entries(entry.metadata ?? {})
                          .filter(([, value]) => value !== null)
                          .map(([key, value]) => `${key}: ${String(value)}`)
                          .join(" · ")}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination page={data.page} totalPages={data.totalPages} onPage={setPage} />
          </div>
        )}
      </QueryView>
    </>
  );
}

const STATUS_VARIANT: Record<
  SystemStatus["health"]["status"],
  "outline" | "secondary" | "destructive"
> = {
  Healthy: "outline",
  Degraded: "secondary",
  Unhealthy: "destructive",
};

export function SystemHealth() {
  const query = useQuery({
    queryKey: ["admin", "system"],
    queryFn: ({ signal }) => adminRepository.system(signal),
    refetchInterval: 15_000,
  });

  return (
    <>
      <PageHeader
        title="System health"
        description="Dependencies and worker queues. Refreshes every 15 seconds."
      />
      <QueryView query={query} skeletonRows={6}>
        {(system) => (
          <div className="flex flex-col gap-6">
            <section aria-labelledby="deps-heading" className="flex flex-col gap-3">
              <h2 id="deps-heading" className="flex items-center gap-2 text-sm font-medium">
                Dependencies{" "}
                <Badge variant={STATUS_VARIANT[system.health.status]}>{system.health.status}</Badge>
              </h2>
              <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {system.health.entries.map((entry) => (
                  <li
                    key={entry.name}
                    className="flex flex-col gap-1 rounded-lg border p-3 text-sm"
                  >
                    <span className="flex items-center justify-between gap-2">
                      <span className="font-medium">{entry.name}</span>
                      <Badge variant={STATUS_VARIANT[entry.status]}>{entry.status}</Badge>
                    </span>
                    {entry.description ? (
                      <span className="text-xs text-muted-foreground">{entry.description}</span>
                    ) : null}
                  </li>
                ))}
              </ul>
            </section>
            <section aria-labelledby="queues-heading" className="flex flex-col gap-3">
              <h2 id="queues-heading" className="text-sm font-medium">
                Worker queues
              </h2>
              <div className="overflow-x-auto rounded-lg border">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
                    <tr>
                      <th scope="col" className="px-3 py-2 font-medium">
                        Queue
                      </th>
                      <th scope="col" className="px-3 py-2 text-right font-medium">
                        Waiting
                      </th>
                      <th scope="col" className="px-3 py-2 text-right font-medium">
                        Consumers
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {system.queues.map((queue) => {
                      const deadLetter = queue.queue.endsWith(".dead-letter");
                      const alarming = deadLetter
                        ? queue.messages > 0
                        : queue.consumers === 0 || queue.messages > 100;
                      return (
                        <tr key={queue.queue} className="border-t">
                          <td className="px-3 py-2 font-mono text-xs">{queue.queue}</td>
                          <td
                            className={
                              alarming && queue.messages > 0
                                ? "px-3 py-2 text-right font-medium text-destructive"
                                : "px-3 py-2 text-right"
                            }
                          >
                            {queue.messages}
                          </td>
                          <td
                            className={
                              !deadLetter && queue.consumers === 0
                                ? "px-3 py-2 text-right font-medium text-destructive"
                                : "px-3 py-2 text-right text-muted-foreground"
                            }
                          >
                            {deadLetter ? "" : queue.consumers}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <p className="text-xs text-muted-foreground">
                Messages in a dead-letter queue failed every retry and need investigation. A queue
                without consumers means the workers are down.
              </p>
            </section>
            <p className="text-xs text-muted-foreground">
              Checked {formatRelative(system.checkedAt)}.
            </p>
          </div>
        )}
      </QueryView>
    </>
  );
}
