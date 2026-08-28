"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { apiClient } from "@/lib/api/client";
import { useGlobalLoaderEffect } from "@/components/global-loader";
import {
  LeadContactSheet,
  type LeadContactTarget,
} from "./lead-contact-sheet";
import { LeadEditSheet } from "./lead-edit-sheet";

type NoteRow = {
  id: string;
  body: string;
  createdAt: string;
};

type ActivityRow = {
  id: string;
  type: string;
  title: string;
  createdAt: string;
};

type TaskRow = {
  id: string;
  title: string;
  status: string;
  dueAt: string | null;
};

type LeadDetail = {
  id: string;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  phone: string | null;
  status: string;
  leadScore: number;
  source: string | null;
  company?: { id: string; name: string } | null;
  pipelineStage?: { id: string; name: string } | null;
  notes: NoteRow[];
  activities: ActivityRow[];
  tasks: TaskRow[];
};

function leadLabel(lead: {
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  phone?: string | null;
  company?: { name: string } | null;
}) {
  return (
    [lead.firstName, lead.lastName].filter(Boolean).join(" ") ||
    lead.email ||
    lead.company?.name ||
    lead.phone ||
    "Untitled lead"
  );
}

export function LeadDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const queryClient = useQueryClient();
  const [note, setNote] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [contactOpen, setContactOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);

  const leadQuery = useQuery({
    queryKey: ["lead", id],
    queryFn: () => apiClient<LeadDetail>(`/v1/leads/${id}`),
    enabled: Boolean(id),
  });

  useGlobalLoaderEffect(
    "lead-detail",
    leadQuery.isLoading && !leadQuery.data,
    "Loading lead…",
  );

  const noteMutation = useMutation({
    mutationFn: () =>
      apiClient(`/v1/leads/${id}/notes`, {
        method: "POST",
        body: JSON.stringify({ body: note }),
      }),
    onSuccess: () => {
      setNote("");
      setMessage("Note added.");
      void queryClient.invalidateQueries({ queryKey: ["lead", id] });
    },
    onError: (err: Error) => setMessage(err.message),
  });

  const lead = leadQuery.data;
  const contactTarget: LeadContactTarget | null = lead
    ? {
        id: lead.id,
        firstName: lead.firstName,
        lastName: lead.lastName,
        email: lead.email,
        phone: lead.phone,
        company: lead.company,
      }
    : null;

  if (leadQuery.isError) {
    return (
      <main className="flex flex-1 flex-col gap-4 p-6">
        <p className="text-destructive text-sm">
          {(leadQuery.error as Error).message || "Lead not found"}
        </p>
        <Link href="/leads" className="text-sm underline">
          Back to leads
        </Link>
      </main>
    );
  }

  return (
    <main className="flex flex-1 flex-col gap-6 p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link
            href="/leads"
            className="text-muted-foreground text-xs hover:underline"
          >
            ← Leads
          </Link>
          <h1 className="mt-1 text-xl font-semibold tracking-tight">
            {lead ? leadLabel(lead) : "Lead"}
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            {lead?.email ?? "No email"}
            {lead?.phone ? ` · ${lead.phone}` : ""}
            {lead?.company?.name ? (
              <>
                {" · "}
                <Link
                  href={`/companies/${lead.company.id}`}
                  className="underline-offset-2 hover:underline"
                >
                  {lead.company.name}
                </Link>
              </>
            ) : null}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => setEditOpen(true)}>
            Edit
          </Button>
          <Button
            disabled={!lead?.email && !lead?.phone}
            onClick={() => setContactOpen(true)}
          >
            Contact
          </Button>
        </div>
      </div>

      {message ? (
        <p className="bg-muted/40 rounded-md px-3 py-2 text-sm">{message}</p>
      ) : null}

      <section className="border-border grid gap-3 rounded-lg border p-4 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <div className="text-muted-foreground text-xs uppercase">Status</div>
          <div className="mt-1 capitalize">{lead?.status ?? "—"}</div>
        </div>
        <div>
          <div className="text-muted-foreground text-xs uppercase">Stage</div>
          <div className="mt-1">{lead?.pipelineStage?.name ?? "—"}</div>
        </div>
        <div>
          <div className="text-muted-foreground text-xs uppercase">Score</div>
          <div className="mt-1">{lead?.leadScore ?? "—"}</div>
        </div>
        <div>
          <div className="text-muted-foreground text-xs uppercase">Source</div>
          <div className="mt-1">{lead?.source ?? "—"}</div>
        </div>
      </section>

      <section className="border-border space-y-3 rounded-lg border p-4">
        <h2 className="text-sm font-medium">Notes</h2>
        <Textarea
          rows={3}
          placeholder="Add a note…"
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
        <Button
          size="sm"
          disabled={!note.trim() || noteMutation.isPending}
          onClick={() => noteMutation.mutate()}
        >
          Add note
        </Button>
        <ul className="space-y-2">
          {(lead?.notes ?? []).map((n) => (
            <li
              key={n.id}
              className="border-border rounded-md border p-3 text-sm"
            >
              <p className="whitespace-pre-wrap">{n.body}</p>
              <p className="text-muted-foreground mt-2 text-xs">
                {new Date(n.createdAt).toLocaleString()}
              </p>
            </li>
          ))}
          {!lead?.notes?.length ? (
            <li className="text-muted-foreground text-sm">No notes yet</li>
          ) : null}
        </ul>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="border-border space-y-3 rounded-lg border p-4">
          <h2 className="text-sm font-medium">Activities</h2>
          <ul className="space-y-2 text-sm">
            {(lead?.activities ?? []).map((a) => (
              <li
                key={a.id}
                className="flex justify-between gap-2 border-b border-border/50 py-2"
              >
                <span>{a.title}</span>
                <span className="text-muted-foreground shrink-0 text-xs">
                  {new Date(a.createdAt).toLocaleString()}
                </span>
              </li>
            ))}
            {!lead?.activities?.length ? (
              <li className="text-muted-foreground">No activities</li>
            ) : null}
          </ul>
        </section>

        <section className="border-border space-y-3 rounded-lg border p-4">
          <h2 className="text-sm font-medium">Tasks</h2>
          <ul className="space-y-2 text-sm">
            {(lead?.tasks ?? []).map((t) => (
              <li
                key={t.id}
                className="flex justify-between gap-2 border-b border-border/50 py-2"
              >
                <span>
                  {t.title}
                  <span className="text-muted-foreground ml-2 capitalize">
                    ({t.status})
                  </span>
                </span>
                <span className="text-muted-foreground shrink-0 text-xs">
                  {t.dueAt ? new Date(t.dueAt).toLocaleDateString() : "—"}
                </span>
              </li>
            ))}
            {!lead?.tasks?.length ? (
              <li className="text-muted-foreground">
                No tasks — create on{" "}
                <Link href="/tasks" className="underline">
                  Tasks
                </Link>
              </li>
            ) : null}
          </ul>
        </section>
      </div>

      <LeadEditSheet
        lead={contactTarget}
        open={editOpen}
        onOpenChange={setEditOpen}
        onSaved={() => setMessage("Lead updated.")}
      />

      <LeadContactSheet
        lead={contactTarget}
        open={contactOpen}
        onOpenChange={setContactOpen}
      />
    </main>
  );
}
