"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { FadeIn } from "@/components/motion/fade-in";
import { StatTile } from "@/components/ui/stat-tile";
import { useGlobalLoaderEffect } from "@/components/global-loader";
import { apiClient } from "@/lib/api/client";
import { authApi } from "@/features/auth/api/auth-api";

type FunnelStage = { id: string; name: string; count: number };

type ActivityRow = {
  id: string;
  type: string;
  title: string;
  createdAt: string;
  lead: {
    id: string;
    firstName: string | null;
    lastName: string | null;
    email: string | null;
  } | null;
};

type DashboardStats = {
  leadsTotal: number;
  leadsNewWeek: number;
  openTasks: number;
  messagesOutWeek: number;
  dealsOpen: number;
  dealsWon: number;
  credits: number;
  funnel: FunnelStage[];
  recentActivities: ActivityRow[];
};

function leadLabel(lead: NonNullable<ActivityRow["lead"]>) {
  return (
    [lead.firstName, lead.lastName].filter(Boolean).join(" ") ||
    lead.email ||
    "Lead"
  );
}

export function DashboardPage() {
  const me = useQuery({ queryKey: ["me"], queryFn: () => authApi.me() });
  const stats = useQuery({
    queryKey: ["dashboard-stats"],
    queryFn: () => apiClient<DashboardStats>("/v1/dashboard/stats"),
  });

  useGlobalLoaderEffect(
    "dashboard",
    stats.isLoading && !stats.data,
    "Loading dashboard…",
  );

  const data = stats.data;
  const funnelMax = Math.max(1, ...(data?.funnel.map((f) => f.count) ?? [1]));

  return (
    <main className="flex flex-1 flex-col gap-6 p-6 md:p-8">
      <FadeIn>
        <h1 className="font-heading text-2xl font-semibold tracking-tight">
          Dashboard
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Welcome
          {me.data?.user.firstName ? `, ${me.data.user.firstName}` : ""}. Your
          workspace at a glance.
        </p>
      </FadeIn>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile label="Leads" value={data?.leadsTotal ?? "—"} delay={0.05} />
        <StatTile
          label="New this week"
          value={data?.leadsNewWeek ?? "—"}
          delay={0.08}
        />
        <StatTile
          label="Open tasks"
          value={data?.openTasks ?? "—"}
          delay={0.11}
        />
        <StatTile
          label="Messages (7d)"
          value={data?.messagesOutWeek ?? "—"}
          delay={0.14}
        />
        <StatTile
          label="Open deals"
          value={data?.dealsOpen ?? "—"}
          delay={0.17}
        />
        <StatTile
          label="Won deals"
          value={data?.dealsWon ?? "—"}
          delay={0.2}
        />
        <StatTile label="Credits" value={data?.credits ?? "—"} delay={0.23} />
      </div>

      <FadeIn delay={0.12}>
        <section className="border-border space-y-4 rounded-lg border p-4">
          <h2 className="text-sm font-medium">Pipeline funnel</h2>
          {(data?.funnel ?? []).length ? (
            <ul className="space-y-3">
              {data!.funnel.map((stage) => (
                <li key={stage.id} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span>{stage.name}</span>
                    <span className="text-muted-foreground">{stage.count}</span>
                  </div>
                  <div className="bg-muted h-2 overflow-hidden rounded-full">
                    <div
                      className="h-full rounded-full bg-emerald-500/80 transition-all"
                      style={{
                        width: `${Math.max(4, (stage.count / funnelMax) * 100)}%`,
                      }}
                    />
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-muted-foreground text-sm">
              No pipeline stages yet.
            </p>
          )}
        </section>
      </FadeIn>

      <FadeIn delay={0.16}>
        <section className="border-border space-y-3 rounded-lg border p-4">
          <h2 className="text-sm font-medium">Recent activity</h2>
          <ul className="space-y-2">
            {(data?.recentActivities ?? []).map((item) => (
              <li
                key={item.id}
                className="flex flex-wrap items-baseline justify-between gap-2 border-b border-border/50 py-2 text-sm last:border-0"
              >
                <div>
                  <span className="font-medium">{item.title}</span>
                  {item.lead ? (
                    <>
                      {" · "}
                      <Link
                        href={`/leads/${item.lead.id}`}
                        className="text-emerald-400 underline-offset-2 hover:underline"
                      >
                        {leadLabel(item.lead)}
                      </Link>
                    </>
                  ) : null}
                </div>
                <span className="text-muted-foreground text-xs">
                  {new Date(item.createdAt).toLocaleString()}
                </span>
              </li>
            ))}
            {!data?.recentActivities?.length ? (
              <li className="text-muted-foreground text-sm">No activity yet.</li>
            ) : null}
          </ul>
        </section>
      </FadeIn>
    </main>
  );
}
