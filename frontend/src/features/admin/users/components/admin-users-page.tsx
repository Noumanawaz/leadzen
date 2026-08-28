"use client";

import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { apiClient } from "@/lib/api/client";

type UserRow = {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  status: string;
  createdAt: string;
  memberships: Array<{
    role: string;
    organization: { name: string };
  }>;
  platformAdmins: Array<{ id: string; status: string }>;
};

export function AdminUsersPage() {
  const [search, setSearch] = useState("");
  const usersQuery = useQuery({
    queryKey: ["admin-users", search],
    queryFn: () =>
      apiClient<UserRow[]>(
        `/admin/users${search ? `?search=${encodeURIComponent(search)}` : ""}`,
      ),
  });

  return (
    <main className="flex flex-1 flex-col gap-6 p-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Users</h1>
        <p className="text-muted-foreground text-sm">
          All accounts across tenant workspaces
        </p>
      </div>
      <Input
        className="max-w-sm"
        placeholder="Search email or name…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="text-muted-foreground border-b">
            <tr>
              <th className="py-2 pr-4 font-medium">User</th>
              <th className="py-2 pr-4 font-medium">Status</th>
              <th className="py-2 pr-4 font-medium">Workspaces</th>
              <th className="py-2 font-medium">Platform admin</th>
            </tr>
          </thead>
          <tbody>
            {(usersQuery.data ?? []).map((user) => (
              <tr key={user.id} className="border-b border-border/60">
                <td className="py-2 pr-4">
                  <div>{user.email}</div>
                  <div className="text-muted-foreground text-xs">
                    {[user.firstName, user.lastName].filter(Boolean).join(" ") ||
                      "—"}
                  </div>
                </td>
                <td className="py-2 pr-4 capitalize">{user.status}</td>
                <td className="py-2 pr-4">
                  {user.memberships
                    .map((m) => `${m.organization.name} (${m.role})`)
                    .join(", ") || "—"}
                </td>
                <td className="py-2">
                  {user.platformAdmins[0]?.status ?? "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}
