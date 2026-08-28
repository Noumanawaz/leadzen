"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { apiClient } from "@/lib/api/client";

type Plan = {
  id: string;
  code: string;
  name: string;
  amountCents: number;
  interval: string;
  creditsGranted: number;
  maxUsers: number;
  maxLeads: number;
};

type Subscription = {
  status: string;
  currentPeriodEnd: string | null;
  plan: { name: string; code: string; amountCents: number } | null;
} | null;

export function BillingSettingsPage() {
  const plansQuery = useQuery({
    queryKey: ["billing-plans"],
    queryFn: () => apiClient<Plan[]>("/v1/billing/plans"),
  });

  const subQuery = useQuery({
    queryKey: ["billing-subscription"],
    queryFn: () => apiClient<Subscription>("/v1/billing/subscription"),
  });

  const syncMutation = useMutation({
    mutationFn: () =>
      apiClient("/v1/billing/sync-catalog", { method: "POST" }),
    onSuccess: () => {
      void plansQuery.refetch();
    },
  });

  const checkoutMutation = useMutation({
    mutationFn: (planCode: string) =>
      apiClient<{ url: string }>("/v1/billing/checkout", {
        method: "POST",
        body: JSON.stringify({ planCode }),
      }),
    onSuccess: (data) => {
      if (data.url) window.location.href = data.url;
    },
  });

  const portalMutation = useMutation({
    mutationFn: () =>
      apiClient<{ url: string }>("/v1/billing/portal", { method: "POST" }),
    onSuccess: (data) => {
      if (data.url) window.location.href = data.url;
    },
  });

  return (
    <main className="flex flex-1 flex-col gap-8 p-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Billing</h1>
          <p className="text-muted-foreground text-sm">
            Plans, credits packs, and Stripe customer portal
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => syncMutation.mutate()}
            disabled={syncMutation.isPending}
          >
            Sync Stripe catalog
          </Button>
          <Button
            variant="outline"
            onClick={() => portalMutation.mutate()}
            disabled={portalMutation.isPending}
          >
            Open portal
          </Button>
        </div>
      </div>

      <section className="border-border rounded-lg border p-4">
        <h2 className="text-sm font-medium">Current subscription</h2>
        {subQuery.data ? (
          <p className="mt-2 text-sm">
            {subQuery.data.plan?.name ?? "Plan"} —{" "}
            <span className="capitalize">{subQuery.data.status}</span>
            {subQuery.data.currentPeriodEnd
              ? ` · renews ${new Date(subQuery.data.currentPeriodEnd).toLocaleDateString()}`
              : ""}
          </p>
        ) : (
          <p className="text-muted-foreground mt-2 text-sm">
            No paid subscription yet (trial).
          </p>
        )}
      </section>

      <section className="grid gap-4 sm:grid-cols-3">
        {(plansQuery.data ?? []).map((plan) => (
          <div key={plan.id} className="border-border space-y-3 rounded-lg border p-4">
            <div>
              <h3 className="font-medium">{plan.name}</h3>
              <p className="text-muted-foreground text-sm">
                ${(plan.amountCents / 100).toFixed(0)}
                {plan.interval === "one_time" ? "" : "/mo"}
              </p>
            </div>
            <ul className="text-muted-foreground space-y-1 text-xs">
              {plan.interval !== "one_time" ? (
                <>
                  <li>{plan.maxUsers} users</li>
                  <li>{plan.maxLeads.toLocaleString()} leads</li>
                </>
              ) : null}
              <li>{plan.creditsGranted} credits</li>
            </ul>
            <Button
              className="w-full"
              onClick={() => checkoutMutation.mutate(plan.code)}
              disabled={checkoutMutation.isPending}
            >
              {plan.interval === "one_time" ? "Buy credits" : "Subscribe"}
            </Button>
          </div>
        ))}
      </section>
    </main>
  );
}
