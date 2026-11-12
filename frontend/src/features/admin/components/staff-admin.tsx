"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAccount } from "@/features/account/hooks/use-account";
import { errorMessage } from "@/lib/http/error-messages";
import { type Role, ROLES } from "@/lib/schemas/auth";
import { adminRepository, type UserSummary } from "@/repositories/admin-repository";
import { PageHeader, QueryView } from "./admin-ui";

const staffKey = ["admin", "staff"] as const;

const ROLE_HINTS: Record<Role, string> = {
  SuperAdmin: "Everything, including staff management",
  Admin: "Everything except staff management",
  Moderator: "Queue, decisions, escalation, bans, appeals",
  Support: "Dashboard, users, appeals",
};

function RolePicker({
  value,
  onChange,
  idPrefix,
}: {
  value: Role[];
  onChange: (roles: Role[]) => void;
  idPrefix: string;
}) {
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="sr-only">Roles</legend>
      {ROLES.map((role) => (
        <Label
          key={role}
          htmlFor={`${idPrefix}-${role}`}
          className="flex items-start gap-2 font-normal"
        >
          <Checkbox
            id={`${idPrefix}-${role}`}
            className="mt-0.5"
            checked={value.includes(role)}
            onCheckedChange={(checked) =>
              onChange(
                checked === true ? [...value, role] : value.filter((existing) => existing !== role),
              )
            }
          />
          <span>
            {role}
            <span className="block text-xs text-muted-foreground">{ROLE_HINTS[role]}</span>
          </span>
        </Label>
      ))}
    </fieldset>
  );
}

function StaffMember({ member, isSelf }: { member: UserSummary; isSelf: boolean }) {
  const queryClient = useQueryClient();
  const [roles, setRoles] = useState<Role[]>(member.roles);
  const save = useMutation({
    mutationFn: (next: Role[]) => adminRepository.setRoles({ userId: member.id }, next),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: staffKey }),
  });
  const changed = roles.join() !== member.roles.join();

  return (
    <li className="flex flex-col gap-3 rounded-lg border p-4 text-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="font-medium">{member.email}</span>
        <span className="flex gap-1.5">
          {member.twoFactorEnabled ? (
            <Badge variant="outline">2FA</Badge>
          ) : (
            <Badge variant="destructive">No 2FA</Badge>
          )}
          {isSelf ? <Badge variant="secondary">You</Badge> : null}
        </span>
      </div>
      {isSelf ? (
        <p className="text-muted-foreground">
          {member.roles.join(", ")}. Ask another SuperAdmin to change your roles.
        </p>
      ) : (
        <>
          <RolePicker value={roles} onChange={setRoles} idPrefix={`roles-${member.id}`} />
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              disabled={!changed || save.isPending}
              onClick={() => save.mutate(roles)}
            >
              Save roles
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={save.isPending}
              onClick={() => save.mutate([])}
            >
              Remove from staff
            </Button>
          </div>
        </>
      )}
      {save.isError ? (
        <p role="alert" className="text-destructive">
          {errorMessage(save.error)}
        </p>
      ) : null}
    </li>
  );
}

function AddStaff() {
  const queryClient = useQueryClient();
  const [email, setEmail] = useState("");
  const [roles, setRoles] = useState<Role[]>(["Moderator"]);
  const add = useMutation({
    mutationFn: () => adminRepository.setRoles({ email }, roles),
    onSuccess: async () => {
      setEmail("");
      await queryClient.invalidateQueries({ queryKey: staffKey });
    },
  });

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        add.mutate();
      }}
      className="flex flex-col gap-4 rounded-lg border p-4"
    >
      <h2 className="text-sm font-medium">Add a staff member</h2>
      <p className="text-sm text-muted-foreground">
        They need an account with a confirmed email. They will be signed out and must sign in again
        with two-factor authentication to use staff tools.
      </p>
      <div className="flex max-w-md flex-col gap-2">
        <Label htmlFor="staff-email">Email</Label>
        <Input
          id="staff-email"
          type="email"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        />
      </div>
      <RolePicker value={roles} onChange={setRoles} idPrefix="new-staff" />
      {add.isError ? (
        <p role="alert" className="text-sm text-destructive">
          {errorMessage(add.error)}
        </p>
      ) : null}
      <Button type="submit" className="self-start" disabled={add.isPending || roles.length === 0}>
        {add.isPending ? "Adding" : "Add to staff"}
      </Button>
    </form>
  );
}

export function StaffAdmin() {
  const account = useAccount();
  const query = useQuery({
    queryKey: staffKey,
    queryFn: ({ signal }) => adminRepository.staff(signal),
  });
  return (
    <>
      <PageHeader
        title="Staff"
        description="Role changes sign the person out everywhere and are audit-logged."
      />
      <AddStaff />
      <QueryView query={query} empty="No staff yet." isEmpty={(items) => items.length === 0}>
        {(items) => (
          <ul className="flex flex-col gap-3">
            {items.map((member) => (
              <StaffMember
                key={member.id}
                member={member}
                isSelf={member.email === account.data?.email}
              />
            ))}
          </ul>
        )}
      </QueryView>
    </>
  );
}
