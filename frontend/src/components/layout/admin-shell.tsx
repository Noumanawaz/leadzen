"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { useGlobalLoaderEffect } from "@/components/global-loader";
import { apiClient, ApiError } from "@/lib/api/client";
import { authStorage } from "@/lib/auth/auth-storage";
import { cn } from "@/lib/utils";

const nav = [
  { href: "/admin/dashboard", label: "Dashboard" },
  { href: "/admin/organizations", label: "Organizations" },
  { href: "/admin/users", label: "Users" },
  { href: "/admin/settings", label: "Settings" },
];

export function AdminShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();

  const meQuery = useQuery({
    queryKey: ["admin-me"],
    queryFn: () =>
      apiClient<{
        user: { email: string };
        platformAdmin: { id: string; status: string };
      }>("/admin/me"),
    retry: false,
    enabled: Boolean(authStorage.getAccessToken()),
  });

  useEffect(() => {
    if (!authStorage.getAccessToken()) {
      router.replace("/login");
      return;
    }
    if (meQuery.isError) {
      const status = (meQuery.error as ApiError).status;
      if (status === 401) router.replace("/login");
      if (status === 403) router.replace("/dashboard");
    }
  }, [meQuery.isError, meQuery.error, router]);

  useGlobalLoaderEffect(
    "admin-shell-auth",
    meQuery.isLoading,
    "Checking platform admin access…",
  );

  if (meQuery.isLoading) {
    return null;
  }

  if (meQuery.isError) {
    return (
      <div className="text-muted-foreground flex flex-1 flex-col items-center justify-center gap-2 p-8 text-sm">
        <p>Platform admin access required.</p>
        <Link href="/dashboard" className="text-foreground underline">
          Back to workspace
        </Link>
      </div>
    );
  }

  return (
    <div className="bg-background flex min-h-full flex-1">
      <aside className="bg-sidebar text-sidebar-foreground border-sidebar-border hidden w-60 flex-col border-r p-4 md:flex">
        <div className="mb-1 font-heading text-base font-semibold tracking-tight text-white">
          Platform Admin
        </div>
        <p className="mb-6 truncate text-xs text-white/40">
          {meQuery.data?.user.email}
        </p>
        <nav className="flex flex-col gap-0.5 text-sm">
          {nav.map((item) => {
            const active = pathname === item.href;
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
        </nav>
        <Link
          href="/dashboard"
          className="mt-auto px-2.5 py-1.5 text-xs text-white/45 hover:text-white"
        >
          ← Workspace
        </Link>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">{children}</div>
    </div>
  );
}
