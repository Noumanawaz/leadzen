"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { apiClient } from "@/lib/api/client";

type SuppressionRow = {
  id: string;
  email: string | null;
  phone: string | null;
  reason: string;
  source: string | null;
  createdAt: string;
};

export function SuppressionsPage() {
  const queryClient = useQueryClient();
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [reason, setReason] = useState("manual");
  const [message, setMessage] = useState<string | null>(null);

  const listQuery = useQuery({
    queryKey: ["suppressions"],
    queryFn: () =>
      apiClient<SuppressionRow[]>("/v1/integrations/suppressions"),
  });

  const addMutation = useMutation({
    mutationFn: () =>
      apiClient("/v1/integrations/suppressions", {
        method: "POST",
        body: JSON.stringify({
          email: email || undefined,
          phone: phone || undefined,
          reason,
        }),
      }),
    onSuccess: () => {
      setEmail("");
      setPhone("");
      setMessage("Suppression added.");
      void queryClient.invalidateQueries({ queryKey: ["suppressions"] });
    },
    onError: (err: Error) => setMessage(err.message),
  });

  const removeMutation = useMutation({
    mutationFn: (id: string) =>
      apiClient(`/v1/integrations/suppressions/${id}`, {
        method: "DELETE",
      }),
    onSuccess: () => {
      setMessage("Suppression removed.");
      void queryClient.invalidateQueries({ queryKey: ["suppressions"] });
    },
    onError: (err: Error) => setMessage(err.message),
  });

  return (
    <main className="flex flex-1 flex-col gap-6 p-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Suppressions</h1>
        <p className="text-muted-foreground text-sm">
          Emails and phones that must not receive outreach
        </p>
      </div>

      {message ? (
        <p className="bg-muted/40 rounded-md px-3 py-2 text-sm">{message}</p>
      ) : null}

      <section className="border-border space-y-3 rounded-lg border p-4">
        <h2 className="text-sm font-medium">Add suppression</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Input
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <Input
            placeholder="Phone (E.164)"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />
          <Input
            placeholder="Reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
          <Button
            onClick={() => addMutation.mutate()}
            disabled={
              (!email && !phone) || !reason.trim() || addMutation.isPending
            }
          >
            Add
          </Button>
        </div>
      </section>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="text-muted-foreground border-b">
            <tr>
              <th className="py-2 pr-4 font-medium">Email</th>
              <th className="py-2 pr-4 font-medium">Phone</th>
              <th className="py-2 pr-4 font-medium">Reason</th>
              <th className="py-2 pr-4 font-medium">Added</th>
              <th className="py-2 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {(listQuery.data ?? []).map((row) => (
              <tr key={row.id} className="border-b border-border/60">
                <td className="py-2 pr-4">{row.email ?? "—"}</td>
                <td className="py-2 pr-4">{row.phone ?? "—"}</td>
                <td className="py-2 pr-4">{row.reason}</td>
                <td className="py-2 pr-4">
                  {new Date(row.createdAt).toLocaleString()}
                </td>
                <td className="py-2">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={removeMutation.isPending}
                    onClick={() => removeMutation.mutate(row.id)}
                  >
                    Remove
                  </Button>
                </td>
              </tr>
            ))}
            {!listQuery.data?.length ? (
              <tr>
                <td colSpan={5} className="text-muted-foreground py-6">
                  No suppressions yet
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </main>
  );
}
