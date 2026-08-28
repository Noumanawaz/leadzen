"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { apiClient } from "@/lib/api/client";

type LeadOption = {
  id: string;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
};

type TaskRow = {
  id: string;
  title: string;
  status: string;
  priority: string;
  dueAt: string | null;
  lead: LeadOption | null;
};

function leadLabel(lead: LeadOption) {
  return (
    [lead.firstName, lead.lastName].filter(Boolean).join(" ") ||
    lead.email ||
    "Lead"
  );
}

export function TasksPage() {
  const queryClient = useQueryClient();
  const [title, setTitle] = useState("");
  const [leadId, setLeadId] = useState("");
  const [dueAt, setDueAt] = useState("");
  const [message, setMessage] = useState<string | null>(null);

  const tasksQuery = useQuery({
    queryKey: ["tasks"],
    queryFn: () => apiClient<TaskRow[]>("/v1/tasks"),
  });

  const leadsQuery = useQuery({
    queryKey: ["leads", "task-picker"],
    queryFn: () => apiClient<LeadOption[]>("/v1/leads"),
  });

  const createMutation = useMutation({
    mutationFn: () =>
      apiClient("/v1/tasks", {
        method: "POST",
        body: JSON.stringify({
          title,
          leadId: leadId || undefined,
          dueAt: dueAt || undefined,
        }),
      }),
    onSuccess: () => {
      setTitle("");
      setLeadId("");
      setDueAt("");
      setMessage("Task created.");
      void queryClient.invalidateQueries({ queryKey: ["tasks"] });
    },
    onError: (err: Error) => setMessage(err.message),
  });

  const completeMutation = useMutation({
    mutationFn: (id: string) =>
      apiClient(`/v1/tasks/${id}/complete`, { method: "PATCH" }),
    onSuccess: () => {
      setMessage("Task completed.");
      void queryClient.invalidateQueries({ queryKey: ["tasks"] });
    },
    onError: (err: Error) => setMessage(err.message),
  });

  return (
    <main className="flex flex-1 flex-col gap-6 p-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Tasks</h1>
        <p className="text-muted-foreground text-sm">
          Follow-ups and to-dos across your pipeline
        </p>
      </div>

      {message ? (
        <p className="bg-muted/40 rounded-md px-3 py-2 text-sm">{message}</p>
      ) : null}

      <section className="border-border space-y-3 rounded-lg border p-4">
        <h2 className="text-sm font-medium">New task</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Input
            placeholder="Title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
          <select
            className="border-input bg-background h-9 rounded-md border px-3 text-sm"
            value={leadId}
            onChange={(e) => setLeadId(e.target.value)}
          >
            <option value="">Lead (optional)…</option>
            {(leadsQuery.data ?? []).map((l) => (
              <option key={l.id} value={l.id}>
                {leadLabel(l)}
              </option>
            ))}
          </select>
          <Input
            type="datetime-local"
            value={dueAt}
            onChange={(e) => setDueAt(e.target.value)}
          />
          <Button
            onClick={() => createMutation.mutate()}
            disabled={!title.trim() || createMutation.isPending}
          >
            Create
          </Button>
        </div>
      </section>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="text-muted-foreground border-b">
            <tr>
              <th className="py-2 pr-4 font-medium">Title</th>
              <th className="py-2 pr-4 font-medium">Lead</th>
              <th className="py-2 pr-4 font-medium">Due</th>
              <th className="py-2 pr-4 font-medium">Status</th>
              <th className="py-2 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {(tasksQuery.data ?? []).map((row) => (
              <tr key={row.id} className="border-b border-border/60">
                <td className="py-2 pr-4 font-medium">{row.title}</td>
                <td className="py-2 pr-4">
                  {row.lead ? (
                    <Link
                      href={`/leads/${row.lead.id}`}
                      className="underline-offset-2 hover:underline"
                    >
                      {leadLabel(row.lead)}
                    </Link>
                  ) : (
                    "—"
                  )}
                </td>
                <td className="py-2 pr-4">
                  {row.dueAt ? new Date(row.dueAt).toLocaleString() : "—"}
                </td>
                <td className="py-2 pr-4 capitalize">{row.status}</td>
                <td className="py-2">
                  {row.status !== "completed" ? (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={completeMutation.isPending}
                      onClick={() => completeMutation.mutate(row.id)}
                    >
                      Complete
                    </Button>
                  ) : (
                    <span className="text-muted-foreground text-xs">Done</span>
                  )}
                </td>
              </tr>
            ))}
            {!tasksQuery.data?.length ? (
              <tr>
                <td colSpan={5} className="text-muted-foreground py-6">
                  No tasks yet
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </main>
  );
}
