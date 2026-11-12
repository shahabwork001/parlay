"use client";

import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { errorMessage } from "@/lib/http/error-messages";
import { adminRepository, type UserDetail } from "@/repositories/admin-repository";
import { BAN_REASON_LABELS, formatDateTime, formatRelative } from "../format";
import { Mono, PageHeader, Pagination, QueryView, SortHeader, Stat } from "./admin-ui";
import { useAdminPermissions } from "./admin-shell";
import { BAN_DURATIONS } from "./ban-dialog";
import { BanList } from "./bans-admin";
import { pageFrom, useUrlState } from "../hooks/use-url-state";

type UserSort = "newest" | "oldest" | "email";
const USER_DEFAULTS = { q: "", sort: "newest", page: "1" };

export function UsersAdmin() {
  const [url, setUrl] = useUrlState(USER_DEFAULTS);
  const [input, setInput] = useState(url.q);
  const sort = url.sort as UserSort;
  const page = pageFrom(url.page);
  const query = useQuery({
    queryKey: ["admin", "users", url.q, sort, page],
    queryFn: ({ signal }) => adminRepository.searchUsers({ q: url.q, sort, page }, signal),
    placeholderData: keepPreviousData,
  });

  return (
    <>
      <PageHeader
        title="Users"
        description="Accounts by email or id. Anonymous people appear in reports by device."
      />
      <form
        role="search"
        className="flex max-w-lg gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          setUrl({ q: input.trim(), page: "1" });
        }}
      >
        <Label htmlFor="user-search" className="sr-only">
          Email or id
        </Label>
        <Input
          id="user-search"
          value={input}
          placeholder="Email or id"
          onChange={(event) => setInput(event.target.value)}
        />
        <Button type="submit">Search</Button>
      </form>
      <QueryView
        query={query}
        empty="No accounts match."
        isEmpty={(data) => data.items.length === 0}
      >
        {(data) => (
          <div className="flex flex-col gap-3">
            <div className="overflow-x-auto rounded-lg border">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
                  <tr>
                    <SortHeader
                      label="Email"
                      direction={sort === "email" ? "ascending" : null}
                      onSort={() => setUrl({ sort: "email", page: "1" })}
                    />
                    <th scope="col" className="px-3 py-2 font-medium">
                      Roles
                    </th>
                    <th scope="col" className="px-3 py-2 font-medium">
                      Status
                    </th>
                    <SortHeader
                      label="Joined"
                      direction={
                        sort === "newest" ? "descending" : sort === "oldest" ? "ascending" : null
                      }
                      onSort={() =>
                        setUrl({ sort: sort === "newest" ? "oldest" : "newest", page: "1" })
                      }
                    />
                  </tr>
                </thead>
                <tbody>
                  {data.items.map((user) => (
                    <tr key={user.id} className="border-t">
                      <td className="px-3 py-2">
                        <Link
                          href={`/admin/users/${user.id}`}
                          className="font-medium underline-offset-4 hover:underline"
                        >
                          {user.email}
                        </Link>
                      </td>
                      <td className="px-3 py-2">{user.roles.join(", ") || "None"}</td>
                      <td className="px-3 py-2 text-muted-foreground">
                        {user.emailVerified ? "Verified" : "Unverified"}
                        {user.twoFactorEnabled ? " · 2FA" : ""}
                      </td>
                      <td className="px-3 py-2 text-muted-foreground">
                        {formatRelative(user.createdAt)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination
              page={data.page}
              totalPages={data.totalPages}
              onPage={(next) => setUrl({ page: String(next) })}
            />
          </div>
        )}
      </QueryView>
    </>
  );
}

function ManualBan({ detail }: { detail: UserDetail }) {
  const queryClient = useQueryClient();
  const devices = [...new Set(detail.sessions.map((session) => session.deviceId))];
  const [includeDevices, setIncludeDevices] = useState(true);
  const [reason, setReason] = useState<
    "harassment" | "spam" | "scam" | "hate" | "sexual-content" | "other"
  >("harassment");
  const [duration, setDuration] = useState<string>("72");
  const [shadow, setShadow] = useState(false);
  const issue = useMutation({
    mutationFn: () =>
      adminRepository.issueBan({
        accountId: detail.user.id,
        ...(includeDevices && devices.length > 0 ? { deviceIds: devices } : {}),
        includeSubnet: false,
        mode: shadow ? "shadow" : "full",
        reason,
        durationHours: BAN_DURATIONS.find((option) => option.value === duration)?.hours ?? 72,
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin"] }),
  });

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        issue.mutate();
      }}
      className="flex flex-col gap-4 rounded-lg border p-4"
    >
      <h2 className="text-sm font-medium">Ban this account</h2>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Label htmlFor="manual-ban-reason">Reason</Label>
          <select
            id="manual-ban-reason"
            value={reason}
            onChange={(event) => setReason(event.target.value as typeof reason)}
            className="h-9 rounded-md border bg-background px-3 text-sm"
          >
            {(["harassment", "hate", "sexual-content", "spam", "scam", "other"] as const).map(
              (value) => (
                <option key={value} value={value}>
                  {BAN_REASON_LABELS[value]}
                </option>
              ),
            )}
          </select>
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="manual-ban-duration">Duration</Label>
          <select
            id="manual-ban-duration"
            value={duration}
            onChange={(event) => setDuration(event.target.value)}
            className="h-9 rounded-md border bg-background px-3 text-sm"
          >
            {BAN_DURATIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      </div>
      <Label htmlFor="manual-ban-devices" className="flex items-center gap-2 font-normal">
        <Checkbox
          id="manual-ban-devices"
          checked={includeDevices}
          onCheckedChange={(checked) => setIncludeDevices(checked === true)}
        />
        Include the {devices.length} device{devices.length === 1 ? "" : "s"} they signed in from
      </Label>
      <Label htmlFor="manual-ban-shadow" className="flex items-center gap-2 font-normal">
        <Checkbox
          id="manual-ban-shadow"
          checked={shadow}
          onCheckedChange={(checked) => setShadow(checked === true)}
        />
        Shadow ban (no notice; matched only with other shadow-banned people)
      </Label>
      {issue.isError ? (
        <p role="alert" className="text-sm text-destructive">
          {errorMessage(issue.error)}
        </p>
      ) : null}
      {issue.isSuccess ? <p className="text-sm text-muted-foreground">Ban issued.</p> : null}
      <Button type="submit" variant="destructive" className="self-start" disabled={issue.isPending}>
        {issue.isPending ? "Banning" : "Ban"}
      </Button>
    </form>
  );
}

export function UserDetailView({ userId }: { userId: string }) {
  const permissions = useAdminPermissions();
  const query = useQuery({
    queryKey: ["admin", "user", userId],
    queryFn: ({ signal }) => adminRepository.user(userId, signal),
  });

  return (
    <QueryView query={query} skeletonRows={6}>
      {(detail) => (
        <div className="flex flex-col gap-6">
          <PageHeader
            title={detail.user.email}
            description={`Joined ${formatDateTime(detail.user.createdAt)}`}
            actions={
              <div className="flex flex-wrap gap-1.5">
                {detail.user.roles.map((role) => (
                  <Badge key={role}>{role}</Badge>
                ))}
                <Badge variant="outline">
                  {detail.user.emailVerified ? "Email verified" : "Email unverified"}
                </Badge>
                {detail.user.twoFactorEnabled ? <Badge variant="outline">2FA</Badge> : null}
              </div>
            }
          />
          <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Stat
              label="Trust"
              value={detail.trust}
              hint={detail.trust < 25 ? "Low-trust pool" : "Standard pool"}
            />
            <Stat
              label="Reports against"
              value={detail.reportsAgainst.total}
              hint={`${detail.reportsAgainst.upheld} upheld`}
            />
            <Stat
              label="Reports filed"
              value={detail.reportsFiled.total}
              hint={`${detail.reportsFiled.dismissed} dismissed`}
            />
            <Stat label="Bans" value={detail.bans.totalCount} />
          </dl>

          <section aria-labelledby="sessions-heading" className="flex flex-col gap-2">
            <h2 id="sessions-heading" className="text-sm font-medium">
              Sign-ins (metadata only)
            </h2>
            {detail.sessions.length === 0 ? (
              <p className="text-sm text-muted-foreground">No sign-ins in the last 30 days.</p>
            ) : (
              <div className="overflow-x-auto rounded-lg border">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
                    <tr>
                      <th scope="col" className="px-3 py-2 font-medium">
                        Device
                      </th>
                      <th scope="col" className="px-3 py-2 font-medium">
                        Started
                      </th>
                      <th scope="col" className="px-3 py-2 font-medium">
                        Last active
                      </th>
                      <th scope="col" className="px-3 py-2 font-medium">
                        Status
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {detail.sessions.map((session) => (
                      <tr key={session.familyId} className="border-t">
                        <td className="px-3 py-2">
                          <Mono value={session.deviceId} />
                        </td>
                        <td className="px-3 py-2 text-muted-foreground">
                          {formatDateTime(session.startedAt)}
                        </td>
                        <td className="px-3 py-2 text-muted-foreground">
                          {formatRelative(session.lastActiveAt)}
                        </td>
                        <td className="px-3 py-2 text-muted-foreground">
                          {session.active ? "Signed in" : "Ended"}
                          {session.mfa ? " · 2FA" : ""}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section aria-labelledby="bans-heading" className="flex flex-col gap-2">
            <h2 id="bans-heading" className="text-sm font-medium">
              Bans
            </h2>
            <BanList filter="all" target={detail.user.id} />
          </section>

          {permissions.has("bans.manage") ? <ManualBan detail={detail} /> : null}
          <p className="text-sm">
            <Link href="/admin/users" className="underline underline-offset-4">
              Back to users
            </Link>
          </p>
        </div>
      )}
    </QueryView>
  );
}
