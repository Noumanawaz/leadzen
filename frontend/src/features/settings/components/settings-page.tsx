"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { apiClient } from "@/lib/api/client";
import { PermissionGate } from "@/features/permissions/components/permission-gate";

type MemberRow = {
  id: string;
  role: string;
  status: string;
  user: {
    id: string;
    email: string;
    firstName: string | null;
    lastName: string | null;
  };
};

type OrgCurrent = {
  id: string;
  name: string;
  timezone: string | null;
  businessHoursStart: number | null;
  businessHoursEnd: number | null;
  workingDays: string | null;
};

export function SettingsPage() {
  const queryClient = useQueryClient();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("member");
  const [inviteLink, setInviteLink] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const [orgName, setOrgName] = useState("");
  const [timezone, setTimezone] = useState("UTC");
  const [hoursStart, setHoursStart] = useState("9");
  const [hoursEnd, setHoursEnd] = useState("17");
  const [workingDays, setWorkingDays] = useState("1,2,3,4,5");

  const orgQuery = useQuery({
    queryKey: ["current-org"],
    queryFn: () => apiClient<OrgCurrent>("/v1/organizations/current"),
  });

  useEffect(() => {
    const org = orgQuery.data;
    if (!org) return;
    setOrgName(org.name);
    setTimezone(org.timezone ?? "UTC");
    setHoursStart(String(org.businessHoursStart ?? 9));
    setHoursEnd(String(org.businessHoursEnd ?? 17));
    setWorkingDays(org.workingDays ?? "1,2,3,4,5");
  }, [orgQuery.data]);

  const membersQuery = useQuery({
    queryKey: ["members"],
    queryFn: () => apiClient<MemberRow[]>("/v1/organizations/members"),
  });

  const orgMutation = useMutation({
    mutationFn: () =>
      apiClient("/v1/organizations/current", {
        method: "PATCH",
        body: JSON.stringify({
          name: orgName,
          timezone,
          businessHoursStart: Number(hoursStart),
          businessHoursEnd: Number(hoursEnd),
          workingDays,
        }),
      }),
    onSuccess: () => {
      setMessage("Organization settings saved.");
      void queryClient.invalidateQueries({ queryKey: ["current-org"] });
    },
    onError: (err: Error) => setMessage(err.message),
  });

  const inviteMutation = useMutation({
    mutationFn: () =>
      apiClient<{ inviteToken: string; invitePath?: string }>(
        "/v1/organizations/members/invite",
        {
          method: "POST",
          body: JSON.stringify({ email, role }),
        },
      ),
    onSuccess: (data) => {
      const path = data.invitePath ?? `/invite/${data.inviteToken}`;
      const origin =
        typeof window !== "undefined" ? window.location.origin : "";
      setInviteLink(`${origin}${path}`);
      setEmail("");
      setMessage("Invite created.");
      void queryClient.invalidateQueries({ queryKey: ["members"] });
    },
    onError: (err: Error) => setMessage(err.message),
  });

  const roleMutation = useMutation({
    mutationFn: (params: { membershipId: string; role: string }) =>
      apiClient(`/v1/organizations/members/${params.membershipId}/role`, {
        method: "PATCH",
        body: JSON.stringify({ role: params.role }),
      }),
    onSuccess: () => {
      setMessage("Member role updated.");
      void queryClient.invalidateQueries({ queryKey: ["members"] });
    },
    onError: (err: Error) => setMessage(err.message),
  });

  return (
    <main className="flex flex-1 flex-col gap-8 p-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Settings</h1>
        <p className="text-muted-foreground text-sm">
          Workspace profile, members, and invites
        </p>
      </div>

      {message ? (
        <p className="bg-muted/40 rounded-md px-3 py-2 text-sm">{message}</p>
      ) : null}

      <PermissionGate permission="org:update">
        <section className="border-border space-y-3 rounded-lg border p-4">
          <h2 className="text-sm font-medium">Organization</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <Input
              placeholder="Name"
              value={orgName}
              onChange={(e) => setOrgName(e.target.value)}
            />
            <Input
              placeholder="Timezone (e.g. America/New_York)"
              value={timezone}
              onChange={(e) => setTimezone(e.target.value)}
            />
            <Input
              type="number"
              min={0}
              max={23}
              placeholder="Business hours start (0-23)"
              value={hoursStart}
              onChange={(e) => setHoursStart(e.target.value)}
            />
            <Input
              type="number"
              min={0}
              max={23}
              placeholder="Business hours end (0-23)"
              value={hoursEnd}
              onChange={(e) => setHoursEnd(e.target.value)}
            />
            <Input
              className="sm:col-span-2"
              placeholder="Working days (e.g. 1,2,3,4,5)"
              value={workingDays}
              onChange={(e) => setWorkingDays(e.target.value)}
            />
          </div>
          <Button
            onClick={() => orgMutation.mutate()}
            disabled={!orgName.trim() || orgMutation.isPending}
          >
            Save organization
          </Button>
        </section>
      </PermissionGate>

      <PermissionGate permission="members:invite">
        <section className="space-y-4">
          <h2 className="text-sm font-medium">Invite member</h2>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Input
              placeholder="email@company.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <Select value={role} onValueChange={(v) => setRole(v ?? "member")}>
              <SelectTrigger className="w-full sm:w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="admin">Admin</SelectItem>
                <SelectItem value="manager">Manager</SelectItem>
                <SelectItem value="member">Member</SelectItem>
              </SelectContent>
            </Select>
            <Button
              onClick={() => inviteMutation.mutate()}
              disabled={!email || inviteMutation.isPending}
            >
              Invite
            </Button>
          </div>
          {inviteLink ? (
            <div className="bg-muted/40 space-y-2 rounded-md px-3 py-2 text-sm">
              <p className="text-muted-foreground text-xs">
                Copyable invite link
              </p>
              <code className="block break-all text-xs">{inviteLink}</code>
              <Button
                size="sm"
                variant="outline"
                onClick={() => void navigator.clipboard.writeText(inviteLink)}
              >
                Copy link
              </Button>
            </div>
          ) : null}
        </section>
      </PermissionGate>

      <section className="space-y-3">
        <h2 className="text-sm font-medium">Members</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-muted-foreground border-b">
              <tr>
                <th className="py-2 pr-4 font-medium">Email</th>
                <th className="py-2 pr-4 font-medium">Role</th>
                <th className="py-2 pr-4 font-medium">Status</th>
                <th className="py-2 font-medium">Change role</th>
              </tr>
            </thead>
            <tbody>
              {(membersQuery.data ?? []).map((row) => (
                <tr key={row.id} className="border-b border-border/60">
                  <td className="py-2 pr-4">{row.user.email}</td>
                  <td className="py-2 pr-4 capitalize">{row.role}</td>
                  <td className="py-2 pr-4 capitalize">{row.status}</td>
                  <td className="py-2">
                    {row.role === "owner" ? (
                      <span className="text-muted-foreground text-xs">
                        Owner
                      </span>
                    ) : (
                      <PermissionGate permission="members:update_role">
                        <select
                          className="border-input bg-background h-8 rounded-md border px-2 text-xs"
                          value={row.role}
                          disabled={roleMutation.isPending}
                          onChange={(e) =>
                            roleMutation.mutate({
                              membershipId: row.id,
                              role: e.target.value,
                            })
                          }
                        >
                          <option value="admin">Admin</option>
                          <option value="manager">Manager</option>
                          <option value="member">Member</option>
                        </select>
                      </PermissionGate>
                    )}
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
