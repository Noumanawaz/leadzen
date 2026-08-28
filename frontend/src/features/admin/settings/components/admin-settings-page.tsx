"use client";

import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api/client";

export function AdminSettingsPage() {
  const me = useQuery({
    queryKey: ["admin-me"],
    queryFn: () =>
      apiClient<{
        user: { email: string };
        platformAdmin: { id: string; status: string; mfaRequired: boolean };
        allowlistConfigured: boolean;
      }>("/admin/me"),
  });

  const settings = useQuery({
    queryKey: ["admin-settings"],
    queryFn: () =>
      apiClient<{ allowlistCount: number; note: string }>("/admin/settings"),
  });

  const audit = useQuery({
    queryKey: ["admin-audit"],
    queryFn: () =>
      apiClient<
        Array<{
          id: string;
          action: string;
          targetType: string | null;
          createdAt: string;
        }>
      >("/admin/audit-logs?take=20"),
  });

  return (
    <main className="flex flex-1 flex-col gap-6 p-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Admin settings</h1>
        <p className="text-muted-foreground text-sm">
          Platform admin access is controlled by env allowlist only
        </p>
      </div>

      <section className="border-border space-y-2 rounded-lg border p-4 text-sm">
        <div>
          Signed in as{" "}
          <span className="font-medium">{me.data?.user.email ?? "…"}</span>
        </div>
        <div>
          Admin status:{" "}
          <span className="capitalize">
            {me.data?.platformAdmin.status ?? "…"}
          </span>
        </div>
        <div>
          Allowlist entries: {settings.data?.allowlistCount ?? "…"}
        </div>
        <p className="text-muted-foreground text-xs">{settings.data?.note}</p>
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-medium">Recent audit log</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-muted-foreground border-b">
              <tr>
                <th className="py-2 pr-4 font-medium">Action</th>
                <th className="py-2 pr-4 font-medium">Target</th>
                <th className="py-2 font-medium">When</th>
              </tr>
            </thead>
            <tbody>
              {(audit.data ?? []).map((row) => (
                <tr key={row.id} className="border-b border-border/60">
                  <td className="py-2 pr-4">{row.action}</td>
                  <td className="py-2 pr-4">{row.targetType ?? "—"}</td>
                  <td className="py-2">
                    {new Date(row.createdAt).toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
