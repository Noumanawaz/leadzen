"use client";

import { useQuery } from "@tanstack/react-query";
import { FadeIn } from "@/components/motion/fade-in";
import { Badge } from "@/components/ui/badge";
import { StatTile } from "@/components/ui/stat-tile";
import { apiClient } from "@/lib/api/client";

type Dashboard = {
  totals: {
    organizations: number;
    users: number;
    leads: number;
    subscriptions: number;
    activeSubscriptions: number;
    creditBalance: number;
    aiRequests: number;
    aiProviderCost: number;
    messages: number;
    auditLogs: number;
  };
  recentOrganizations: Array<{
    id: string;
    name: string;
    slug: string;
    status: string;
    createdAt: string;
    plan?: { name: string } | null;
  }>;
  generatedAt: string;
};

export function AdminDashboardPage() {
  const dashboard = useQuery({
    queryKey: ["admin-dashboard"],
    queryFn: () => apiClient<Dashboard>("/admin/dashboard"),
  });

  const t = dashboard.data?.totals;

  const tiles: Array<[string, React.ReactNode]> = [
    ["Organizations", t?.organizations],
    ["Users", t?.users],
    ["Leads", t?.leads],
    ["Active subs", t?.activeSubscriptions],
    ["Credit balance", t?.creditBalance],
    ["AI requests", t?.aiRequests],
    [
      "AI cost (USD)",
      t?.aiProviderCost?.toFixed?.(4) ?? t?.aiProviderCost,
    ],
    ["Messages", t?.messages],
  ];

  return (
    <main className="flex flex-1 flex-col gap-6 p-6 md:p-8">
      <FadeIn>
        <h1 className="font-heading text-2xl font-semibold tracking-tight">
          Platform dashboard
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Cross-tenant aggregates. Access requires an allowlisted platform
          admin.
        </p>
      </FadeIn>

      {dashboard.isError ? (
        <p className="text-destructive text-sm">
          {(dashboard.error as Error).message}
        </p>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {tiles.map(([label, value], i) => (
          <StatTile
            key={String(label)}
            label={String(label)}
            value={dashboard.isLoading ? "…" : (value ?? "—")}
            delay={0.04 * i}
          />
        ))}
      </div>

      <FadeIn delay={0.15}>
        <section className="surface-elevated rounded-xl p-5">
          <h2 className="font-heading text-sm font-semibold tracking-tight">
            Recent organizations
          </h2>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-muted-foreground border-b text-xs tracking-wide uppercase">
                <tr>
                  <th className="py-2.5 pr-4 font-medium">Name</th>
                  <th className="py-2.5 pr-4 font-medium">Status</th>
                  <th className="py-2.5 pr-4 font-medium">Plan</th>
                  <th className="py-2.5 font-medium">Created</th>
                </tr>
              </thead>
              <tbody>
                {(dashboard.data?.recentOrganizations ?? []).map((org) => (
                  <tr
                    key={org.id}
                    className="border-border/60 border-b last:border-0"
                  >
                    <td className="py-3 pr-4 font-medium">{org.name}</td>
                    <td className="py-3 pr-4">
                      <Badge
                        variant="secondary"
                        className="capitalize"
                      >
                        {org.status}
                      </Badge>
                    </td>
                    <td className="text-muted-foreground py-3 pr-4">
                      {org.plan?.name ?? "—"}
                    </td>
                    <td className="text-muted-foreground py-3">
                      {new Date(org.createdAt).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </FadeIn>
    </main>
  );
}
