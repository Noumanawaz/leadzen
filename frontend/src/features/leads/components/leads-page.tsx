"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useMemo, useState } from "react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { apiClient } from "@/lib/api/client";
import { useGlobalLoaderEffect } from "@/components/global-loader";
import {
  LeadContactSheet,
  type LeadContactTarget,
} from "./lead-contact-sheet";
import { LeadEditSheet, type LeadEditTarget } from "./lead-edit-sheet";

type Stage = { id: string; name: string; position: number };
type Pipeline = {
  id: string;
  name: string;
  isDefault: boolean;
  stages: Stage[];
};

type LeadRow = {
  id: string;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  phone: string | null;
  status: string;
  leadScore: number;
  pipelineId: string | null;
  pipelineStageId: string | null;
  company?: { name: string } | null;
  pipelineStage?: { id: string; name: string } | null;
};

type SequenceRow = { id: string; name: string; status: string };

function leadLabel(lead: LeadRow) {
  return (
    [lead.firstName, lead.lastName].filter(Boolean).join(" ") ||
    lead.email ||
    lead.company?.name ||
    lead.phone ||
    "Untitled lead"
  );
}

export function LeadsPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [email, setEmail] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [stageId, setStageId] = useState("");
  const [enrollLeadId, setEnrollLeadId] = useState("");
  const [enrollSequenceId, setEnrollSequenceId] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [contactLead, setContactLead] = useState<LeadContactTarget | null>(
    null,
  );
  const [contactOpen, setContactOpen] = useState(false);
  const [editLead, setEditLead] = useState<LeadEditTarget | null>(null);
  const [editOpen, setEditOpen] = useState(false);

  const pipelinesQuery = useQuery({
    queryKey: ["pipelines"],
    queryFn: async () => {
      let pipelines = await apiClient<Pipeline[]>("/v1/pipelines");
      if (!pipelines.length) {
        await apiClient("/v1/pipelines/ensure-default", { method: "POST" });
        pipelines = await apiClient<Pipeline[]>("/v1/pipelines");
      }
      return pipelines;
    },
  });

  const defaultPipeline = pipelinesQuery.data?.[0];
  const stages = defaultPipeline?.stages ?? [];

  const leadsQuery = useQuery({
    queryKey: ["leads", search],
    queryFn: () =>
      apiClient<LeadRow[]>(
        `/v1/leads${search ? `?search=${encodeURIComponent(search)}` : ""}`,
      ),
  });

  const sequencesQuery = useQuery({
    queryKey: ["sequences"],
    queryFn: () => apiClient<SequenceRow[]>("/v1/sequences"),
  });

  const activeSequences = useMemo(
    () => (sequencesQuery.data ?? []).filter((s) => s.status === "active"),
    [sequencesQuery.data],
  );

  useGlobalLoaderEffect(
    "leads-page",
    leadsQuery.isLoading && !leadsQuery.data,
    "Loading leads…",
  );

  const createMutation = useMutation({
    mutationFn: () => {
      const selectedStage =
        stages.find((s) => s.id === stageId) ?? stages[0] ?? null;
      return apiClient<LeadRow>("/v1/leads", {
        method: "POST",
        body: JSON.stringify({
          email: email || undefined,
          firstName: firstName || undefined,
          lastName: lastName || undefined,
          phone: phone || undefined,
          source: "manual",
          pipelineId: defaultPipeline?.id,
          pipelineStageId: selectedStage?.id,
        }),
      });
    },
    onSuccess: (lead) => {
      setEmail("");
      setFirstName("");
      setLastName("");
      setPhone("");
      setMessage(
        `Created ${leadLabel(lead)}${
          lead.pipelineStage?.name ? ` in ${lead.pipelineStage.name}` : ""
        }. Open Pipelines to move stages, or enroll below.`,
      );
      void queryClient.invalidateQueries({ queryKey: ["leads"] });
    },
    onError: (err) => setMessage((err as Error).message),
  });

  const moveMutation = useMutation({
    mutationFn: (params: {
      leadId: string;
      pipelineId: string;
      pipelineStageId: string;
    }) =>
      apiClient(`/v1/leads/${params.leadId}`, {
        method: "PATCH",
        body: JSON.stringify({
          pipelineId: params.pipelineId,
          pipelineStageId: params.pipelineStageId,
        }),
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["leads"] });
      setMessage("Lead stage updated.");
    },
  });

  const enrollMutation = useMutation({
    mutationFn: () =>
      apiClient(`/v1/sequences/${enrollSequenceId}/enroll`, {
        method: "POST",
        body: JSON.stringify({ leadId: enrollLeadId }),
      }),
    onSuccess: () => {
      setMessage(
        "Lead enrolled in sequence. Steps run automatically (~30s). Open Sequences to stop or inspect.",
      );
      void queryClient.invalidateQueries({ queryKey: ["sequences"] });
    },
    onError: (err) => setMessage((err as Error).message),
  });

  const deleteMutation = useMutation({
    mutationFn: (leadId: string) =>
      apiClient(`/v1/leads/${leadId}`, { method: "DELETE" }),
    onSuccess: () => {
      setMessage("Lead deleted.");
      void queryClient.invalidateQueries({ queryKey: ["leads"] });
    },
    onError: (err) => setMessage((err as Error).message),
  });

  function handleDelete(lead: LeadRow) {
    const name = leadLabel(lead);
    if (!window.confirm(`Delete "${name}"? This cannot be undone.`)) return;
    deleteMutation.mutate(lead.id);
  }

  function openContact(lead: LeadRow) {
    setContactLead(lead);
    setContactOpen(true);
  }

  function openEdit(lead: LeadRow) {
    setEditLead(lead);
    setEditOpen(true);
  }

  return (
    <main className="flex flex-1 flex-col gap-6 p-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <h1 className="text-xl font-semibold tracking-tight">Leads</h1>
          <p className="text-muted-foreground text-sm">
            Create prospects, put them on a pipeline stage, enroll in sequences,
            or contact via email / WhatsApp
          </p>
        </div>
        <div className="flex w-full flex-col gap-2 sm:flex-row sm:items-center lg:w-auto lg:min-w-[28rem]">
          <Input
            className="w-full min-w-0 sm:flex-1 lg:w-64"
            placeholder="Search name, email, phone…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <div className="flex shrink-0 gap-2">
            <Link
              href="/leads/find"
              className={buttonVariants({ variant: "outline", size: "sm" })}
            >
              Find leads
            </Link>
            <Link
              href="/pipelines"
              className={buttonVariants({ variant: "outline", size: "sm" })}
            >
              Pipeline
            </Link>
          </div>
        </div>
      </div>

      {message ? (
        <p className="bg-muted/40 rounded-md px-3 py-2 text-sm">{message}</p>
      ) : null}

      <section className="border-border space-y-3 rounded-lg border p-4">
        <h2 className="text-sm font-medium">Add lead</h2>
        <p className="text-muted-foreground text-xs">
          New leads land on the first pipeline stage automatically (usually{" "}
          <span className="text-foreground">New</span>).
        </p>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Input
            placeholder="First name"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
          />
          <Input
            placeholder="Last name"
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
          />
          <Input
            placeholder="Email *"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <Input
            placeholder="Phone"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />
          <select
            className="border-input bg-background h-9 rounded-md border px-3 text-sm"
            value={stageId || stages[0]?.id || ""}
            onChange={(e) => setStageId(e.target.value)}
          >
            {!stages.length ? (
              <option value="">Loading stages…</option>
            ) : (
              stages.map((s) => (
                <option key={s.id} value={s.id}>
                  Stage: {s.name}
                </option>
              ))
            )}
          </select>
          <Button
            onClick={() => createMutation.mutate()}
            disabled={!email || createMutation.isPending}
          >
            Create lead
          </Button>
        </div>
      </section>

      <section className="border-border space-y-3 rounded-lg border p-4">
        <h2 className="text-sm font-medium">Enroll in sequence</h2>
        <p className="text-muted-foreground text-xs">
          Starts the automated email / WhatsApp / SMS / call cadence for this
          lead. Build sequences on the{" "}
          <Link href="/sequences" className="underline">
            Sequences
          </Link>{" "}
          page.
        </p>
        <div className="grid gap-3 sm:grid-cols-3">
          <select
            className="border-input bg-background h-9 rounded-md border px-3 text-sm"
            value={enrollLeadId}
            onChange={(e) => setEnrollLeadId(e.target.value)}
          >
            <option value="">Select lead…</option>
            {(leadsQuery.data ?? []).map((l) => (
              <option key={l.id} value={l.id}>
                {leadLabel(l)}
              </option>
            ))}
          </select>
          <select
            className="border-input bg-background h-9 rounded-md border px-3 text-sm"
            value={enrollSequenceId}
            onChange={(e) => setEnrollSequenceId(e.target.value)}
          >
            <option value="">Active sequence…</option>
            {activeSequences.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
          <Button
            onClick={() => enrollMutation.mutate()}
            disabled={
              !enrollLeadId ||
              !enrollSequenceId ||
              enrollMutation.isPending ||
              !activeSequences.length
            }
          >
            Enroll
          </Button>
        </div>
        {!activeSequences.length ? (
          <p className="text-muted-foreground text-xs">
            No active sequences. Create one on{" "}
            <Link href="/sequences" className="underline">
              Sequences
            </Link>{" "}
            and click Activate first.
          </p>
        ) : null}
      </section>

      <LeadsTable
        rows={leadsQuery.data ?? []}
        stages={stages}
        pipelineId={defaultPipeline?.id}
        loading={leadsQuery.isLoading}
        deletingId={
          deleteMutation.isPending
            ? (deleteMutation.variables ?? null)
            : null
        }
        onMoveStage={(leadId, pipelineStageId) => {
          if (!defaultPipeline?.id) return;
          moveMutation.mutate({
            leadId,
            pipelineId: defaultPipeline.id,
            pipelineStageId,
          });
        }}
        onDelete={handleDelete}
        onContact={openContact}
        onEdit={openEdit}
      />

      <LeadEditSheet
        lead={editLead}
        open={editOpen}
        onOpenChange={setEditOpen}
        onSaved={() => setMessage("Lead updated.")}
      />

      <LeadContactSheet
        lead={contactLead}
        open={contactOpen}
        onOpenChange={setContactOpen}
      />
    </main>
  );
}

function LeadsTable({
  rows,
  stages,
  pipelineId,
  loading,
  deletingId,
  onMoveStage,
  onDelete,
  onContact,
  onEdit,
}: {
  rows: LeadRow[];
  stages: Stage[];
  pipelineId?: string;
  loading?: boolean;
  deletingId?: string | null;
  onMoveStage: (leadId: string, pipelineStageId: string) => void;
  onDelete: (lead: LeadRow) => void;
  onContact: (lead: LeadRow) => void;
  onEdit: (lead: LeadRow) => void;
}) {
  if (loading) {
    return null;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead className="text-muted-foreground border-b">
          <tr>
            <th className="py-2 pr-4 font-medium">Name</th>
            <th className="py-2 pr-4 font-medium">Email</th>
            <th className="py-2 pr-4 font-medium">Phone</th>
            <th className="py-2 pr-4 font-medium">Company</th>
            <th className="py-2 pr-4 font-medium">Stage</th>
            <th className="py-2 pr-4 font-medium">Move</th>
            <th className="py-2 font-medium">Actions</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} className="border-b border-border/60">
              <td className="py-2 pr-4">
                <Link
                  href={`/leads/${row.id}`}
                  className="font-medium underline-offset-2 hover:underline"
                >
                  {leadLabel(row)}
                </Link>
              </td>
              <td className="py-2 pr-4">{row.email ?? "—"}</td>
              <td className="py-2 pr-4">{row.phone ?? "—"}</td>
              <td className="py-2 pr-4">{row.company?.name ?? "—"}</td>
              <td className="py-2 pr-4">
                {row.pipelineStage?.name ?? "Unassigned"}
              </td>
              <td className="py-2 pr-4">
                <select
                  className="border-input bg-background h-8 max-w-[10rem] rounded-md border px-2 text-xs"
                  value={row.pipelineStageId ?? ""}
                  disabled={!pipelineId || !stages.length}
                  onChange={(e) => {
                    if (e.target.value) onMoveStage(row.id, e.target.value);
                  }}
                >
                  <option value="">Set stage…</option>
                  {stages.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </td>
              <td className="py-2">
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() => onEdit(row)}
                  >
                    Edit
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={!row.email && !row.phone}
                    onClick={() => onContact(row)}
                  >
                    Contact
                  </Button>
                  <Button
                    type="button"
                    variant="destructive"
                    size="sm"
                    disabled={deletingId === row.id}
                    onClick={() => onDelete(row)}
                  >
                    {deletingId === row.id ? "Deleting…" : "Delete"}
                  </Button>
                </div>
              </td>
            </tr>
          ))}
          {!rows.length ? (
            <tr>
              <td colSpan={7} className="text-muted-foreground py-6">
                No leads yet — add one above. It will appear on the Pipeline board.
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </div>
  );
}
