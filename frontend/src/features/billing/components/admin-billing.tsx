"use client";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RequirePermission, useAdminPermissions } from "@/features/admin/components/admin-shell";
import { errorMessage } from "@/lib/http/error-messages";
import { billingKeys, billingRepository } from "@/repositories/billing-repository";
import { dollars } from "./membership";
export function AdminBilling() {
  const permissions = useAdminPermissions();
  const client = useQueryClient();
  const [offset, setOffset] = useState(0);
  const [price, setPrice] = useState("");
  const query = useQuery({
    queryKey: ["admin", "billing", offset],
    queryFn: () => billingRepository.admin(offset),
    enabled: permissions.has("plans.manage"),
    refetchInterval: 30_000,
  });
  const save = useMutation({
    mutationFn: () => billingRepository.price(Math.round(Number(price) * 100)),
    onSuccess: () => client.invalidateQueries({ queryKey: billingKeys.plans }),
  });
  return (
    <RequirePermission permission="plans.manage">
      <div className="flex flex-col gap-5">
        <h1 className="text-2xl font-semibold">Plus preview and billing foundation</h1>
        <p>
          The MVP is free. Edit the proposed public Plus price here. Real checkout is disabled;
          existing billing records are retained.
        </p>
        <Label htmlFor="plus-price">Proposed Plus price (USD / month)</Label>
        <Input
          id="plus-price"
          type="number"
          min="1"
          max="1000"
          step="0.01"
          value={price}
          onChange={(e) => setPrice(e.target.value)}
        />
        <Button
          disabled={!price || Number(price) < 1 || save.isPending}
          onClick={() => save.mutate()}
        >
          Save price
        </Button>
        {save.isSuccess && <p role="status">Price saved.</p>}
        {(query.error || save.error) && (
          <p role="alert">{errorMessage(query.error ?? save.error)}</p>
        )}
        {query.isPending && <p>Loading billing records�</p>}
        <h2 className="text-lg font-medium">Subscriptions</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr>
                <th>Account</th>
                <th>Status</th>
                <th>Price</th>
                <th>Paid through</th>
                <th>Provider</th>
              </tr>
            </thead>
            <tbody>
              {query.data?.subscriptions.map((s) => (
                <tr key={s.id}>
                  <td>{s.userId}</td>
                  <td>
                    {s.status}
                    {s.cancelRequestedAt ? " � cancellation requested" : ""}
                  </td>
                  <td>{dollars(s.amountMinor)}</td>
                  <td>{s.currentPeriodEnd ?? "�"}</td>
                  <td>{s.provider}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <h2 className="text-lg font-medium">Payments</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr>
                <th>Account</th>
                <th>Status</th>
                <th>Amount</th>
                <th>Refunded</th>
                <th>Date</th>
              </tr>
            </thead>
            <tbody>
              {query.data?.payments.map((p) => (
                <tr key={p.id}>
                  <td>{p.userId}</td>
                  <td>{p.status}</td>
                  <td>{dollars(p.amountMinor)}</td>
                  <td>{dollars(p.refundedMinor)}</td>
                  <td>{p.occurredAt}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            disabled={offset === 0}
            onClick={() => setOffset(Math.max(0, offset - 50))}
          >
            Previous
          </Button>
          <Button
            variant="outline"
            disabled={
              (query.data?.subscriptions.length ?? 0) < 50 &&
              (query.data?.payments.length ?? 0) < 50
            }
            onClick={() => setOffset(offset + 50)}
          >
            Next
          </Button>
        </div>
      </div>
    </RequirePermission>
  );
}
