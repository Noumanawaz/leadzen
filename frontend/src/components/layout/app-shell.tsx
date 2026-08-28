"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useGlobalLoaderEffect } from "@/components/global-loader";
import { authApi } from "@/features/auth/api/auth-api";
import { authStorage } from "@/lib/auth/auth-storage";
import { apiClient } from "@/lib/api/client";
import { cn } from "@/lib/utils";

const navGroups = [
  {
    label: "Workspace",
    items: [
      { href: "/dashboard", label: "Dashboard" },
      { href: "/leads", label: "Leads" },
      { href: "/leads/find", label: "Find Leads" },
      { href: "/contacts", label: "Contacts" },
      { href: "/companies", label: "Companies" },
      { href: "/tasks", label: "Tasks" },
      { href: "/deals", label: "Deals" },
    ],
  },
  {
    label: "Outreach",
    items: [
      { href: "/pipelines", label: "Pipelines" },
      { href: "/sequences", label: "Sequences" },
      { href: "/ai", label: "AI" },
    ],
  },
  {
    label: "Settings",
    items: [
      { href: "/settings", label: "Settings" },
      { href: "/settings/billing", label: "Billing" },
      { href: "/settings/integrations", label: "Integrations" },
      { href: "/settings/lead-forms", label: "Lead forms" },
      { href: "/settings/referral-links", label: "Referral links" },
      { href: "/settings/suppressions", label: "Suppressions" },
      { href: "/settings/api-keys", label: "API keys" },
    ],
  },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [authReady, setAuthReady] = useState(false);
  const [hasToken, setHasToken] = useState(false);

  useEffect(() => {
    setHasToken(Boolean(authStorage.getAccessToken()));
    setAuthReady(true);
  }, []);

  const meQuery = useQuery({
    queryKey: ["me"],
    queryFn: () => authApi.me(),
    retry: false,
    enabled: authReady && hasToken,
  });

  const orgsQuery = useQuery({
    queryKey: ["organizations"],
    queryFn: () =>
      apiClient<
        Array<{
          membershipId: string;
          role: string;
          permissions: string[];
          organization: { id: string; name: string; slug: string };
        }>
      >("/v1/organizations"),
    enabled: authReady && hasToken && meQuery.isSuccess,
  });

  const creditsQuery = useQuery({
    queryKey: ["credits"],
    queryFn: () => apiClient<{ balance: number }>("/v1/credits/balance"),
    enabled:
      authReady && hasToken && Boolean(authStorage.getOrganizationId()),
  });

  const adminMeQuery = useQuery({
    queryKey: ["admin-me"],
    queryFn: () => apiClient("/admin/me"),
    retry: false,
    enabled: authReady && hasToken && meQuery.isSuccess,
  });

  useEffect(() => {
    if (!authReady) return;
    if (!hasToken) {
      router.replace("/login");
      return;
    }
    if (meQuery.isError) {
      authStorage.clear();
      setHasToken(false);
      router.replace("/login");
    }
  }, [authReady, hasToken, meQuery.isError, router]);

  useEffect(() => {
    if (!orgsQuery.data?.length) return;
    const current = authStorage.getOrganizationId();
    const stillValid = orgsQuery.data.some(
      (m) => m.organization.id === current,
    );
    if (!current || !stillValid) {
      authStorage.setOrganizationId(orgsQuery.data[0]!.organization.id);
    }
  }, [orgsQuery.data]);

  const authLoading = !authReady || (hasToken && meQuery.isLoading);
  useGlobalLoaderEffect(
    "app-shell-auth",
    authLoading,
    "Loading workspace…",
  );

  if (!authReady || !hasToken || meQuery.isLoading || meQuery.isError) {
    return null;
  }

  const currentOrgId = authStorage.getOrganizationId();

  return (
    <div className="bg-background flex min-h-full flex-1">
      <aside className="bg-sidebar text-sidebar-foreground border-sidebar-border hidden w-60 flex-col border-r p-4 md:flex">
        <Link
          href="/dashboard"
          className="font-heading mb-6 text-base font-semibold tracking-tight text-white"
        >
          Lead SaaS
        </Link>

        <label className="mb-1 text-[10px] font-medium tracking-wider text-white/40 uppercase">
          Workspace
        </label>
        <select
          className="mb-5 w-full rounded-lg border border-white/10 bg-white/5 px-2.5 py-2 text-sm text-white outline-none focus:border-emerald-400/40"
          value={currentOrgId ?? ""}
          onChange={(e) => {
            authStorage.setOrganizationId(e.target.value);
            window.location.reload();
          }}
        >
          {(orgsQuery.data ?? []).map((m) => (
            <option
              key={m.organization.id}
              value={m.organization.id}
              className="bg-zinc-900"
            >
              {m.organization.name}
            </option>
          ))}
        </select>

        <nav className="flex flex-1 flex-col gap-5 overflow-y-auto text-sm">
          {navGroups.map((group) => (
            <div key={group.label}>
              <div className="mb-1.5 px-2 text-[10px] font-medium tracking-wider text-white/35 uppercase">
                {group.label}
              </div>
              <div className="flex flex-col gap-0.5">
                {group.items.map((item) => {
                  const active =
                    pathname === item.href ||
                    (item.href !== "/dashboard" &&
                      pathname.startsWith(item.href));
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={cn(
                        "relative rounded-lg px-2.5 py-1.5 transition-colors",
                        active
                          ? "bg-sidebar-accent text-white"
                          : "text-white/55 hover:bg-white/5 hover:text-white",
                      )}
                    >
                      {active ? (
                        <span className="absolute top-1/2 left-0 h-4 w-0.5 -translate-y-1/2 rounded-full bg-emerald-400" />
                      ) : null}
                      {item.label}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
          {adminMeQuery.isSuccess ? (
            <Link
              href="/admin/dashboard"
              className="rounded-lg px-2.5 py-1.5 text-white/55 hover:bg-white/5 hover:text-white"
            >
              Platform admin
            </Link>
          ) : null}
        </nav>

        <div className="mt-auto pt-4">
          <div className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1.5 text-center text-xs font-medium text-emerald-300">
            Credits: {creditsQuery.data?.balance ?? "—"}
          </div>
        </div>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">{children}</div>
    </div>
  );
}
