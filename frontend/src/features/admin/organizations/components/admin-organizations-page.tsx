"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { apiClient } from "@/lib/api/client";

type OrgRow = {
  id: string;
  name: string;
  slug: string;
  status: string;
  creditAccount?: { balance: number } | null;
  plan?: { name: string } | null;
  _count?: { memberships: number; leads: number };
};

export function AdminOrganizationsPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [adjustOrgId, setAdjustOrgId] = useState("");
  const [amount, setAmount] = useState("100");
  const [reason, setReason] = useState("Platform credit grant");

  const orgsQuery = useQuery({
    queryKey: ["admin-orgs", search],
    queryFn: () =>
      apiClient<OrgRow[]>(
        `/admin/organizations${search ? `?search=${encodeURIComponent(search)}` : ""}`,
      ),
  });

  const adjustMutation = useMutation({
    mutationFn: () =>
      apiClient("/admin/credits/adjust", {
        method: "POST",
        body: JSON.stringify({
          organizationId: adjustOrgId,
          amount: Number(amount),
          reason,
        }),
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["admin-orgs"] });
      void queryClient.invalidateQueries({ queryKey: ["admin-dashboard"] });
    },
  });

  return (
    <main className="flex flex-1 flex-col gap-6 p-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Organizations</h1>
        <p className="text-muted-foreground text-sm">
          Tenant workspaces across the platform
        </p>
      </div>

      <Input
        className="max-w-sm"
        placeholder="Search name or slug…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      <section className="border-border space-y-3 rounded-lg border p-4">
        <h2 className="text-sm font-medium">Adjust credits</h2>
        <div className="grid gap-3 sm:grid-cols-4">
          <select
            className="border-input bg-background h-9 rounded-md border px-3 text-sm"
            value={adjustOrgId}
            onChange={(e) => setAdjustOrgId(e.target.value)}
          >
            <option value="">Select org…</option>
            {(orgsQuery.data ?? []).map((org) => (
              <option key={org.id} value={org.id}>
                {org.name} ({org.creditAccount?.balance ?? 0} credits)
              </option>
            ))}
          </select>
          <Input
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="Amount (+/-)"
          />
          <Input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Reason"
          />
          <Button
            disabled={!adjustOrgId || adjustMutation.isPending}
            onClick={() => adjustMutation.mutate()}
          >
            Apply
          </Button>
        </div>
        {adjustMutation.isError ? (
          <p className="text-destructive text-sm">
            {(adjustMutation.error as Error).message}
          </p>
        ) : null}
      </section>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="text-muted-foreground border-b">
            <tr>
              <th className="py-2 pr-4 font-medium">Name</th>
              <th className="py-2 pr-4 font-medium">Status</th>
              <th className="py-2 pr-4 font-medium">Plan</th>
              <th className="py-2 pr-4 font-medium">Members</th>
              <th className="py-2 pr-4 font-medium">Leads</th>
              <th className="py-2 font-medium">Credits</th>
            </tr>
          </thead>
          <tbody>
            {(orgsQuery.data ?? []).map((org) => (
              <tr key={org.id} className="border-b border-border/60">
                <td className="py-2 pr-4">
                  <div>{org.name}</div>
                  <div className="text-muted-foreground text-xs">{org.slug}</div>
                </td>
                <td className="py-2 pr-4 capitalize">{org.status}</td>
                <td className="py-2 pr-4">{org.plan?.name ?? "—"}</td>
                <td className="py-2 pr-4">{org._count?.memberships ?? 0}</td>
                <td className="py-2 pr-4">{org._count?.leads ?? 0}</td>
                <td className="py-2">{org.creditAccount?.balance ?? 0}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}
