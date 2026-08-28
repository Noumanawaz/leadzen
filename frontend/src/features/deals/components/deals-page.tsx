"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { apiClient } from "@/lib/api/client";

type Stage = { id: string; name: string; position: number };
type Pipeline = {
  id: string;
  name: string;
  isDefault: boolean;
  stages: Stage[];
};

type LeadOption = {
  id: string;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
};

type DealRow = {
  id: string;
  name: string;
  status: string;
  value: number;
  currency: string;
  pipeline: { id: string; name: string } | null;
  stage: { id: string; name: string } | null;
  lead: LeadOption | null;
};

function leadLabel(lead: LeadOption) {
  return (
    [lead.firstName, lead.lastName].filter(Boolean).join(" ") ||
    lead.email ||
    "Lead"
  );
}

export function DealsPage() {
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [pipelineId, setPipelineId] = useState("");
  const [stageId, setStageId] = useState("");
  const [leadId, setLeadId] = useState("");
  const [value, setValue] = useState("");
  const [message, setMessage] = useState<string | null>(null);

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

  const dealsQuery = useQuery({
    queryKey: ["deals"],
    queryFn: () => apiClient<DealRow[]>("/v1/deals"),
  });

  const leadsQuery = useQuery({
    queryKey: ["leads", "deal-picker"],
    queryFn: () => apiClient<LeadOption[]>("/v1/leads"),
  });

  const selectedPipeline = useMemo(() => {
    const list = pipelinesQuery.data ?? [];
    return list.find((p) => p.id === pipelineId) ?? list[0] ?? null;
  }, [pipelinesQuery.data, pipelineId]);

  const stages = selectedPipeline?.stages ?? [];
  const effectivePipelineId = selectedPipeline?.id ?? "";
  const effectiveStageId =
    stageId && stages.some((s) => s.id === stageId)
      ? stageId
      : (stages[0]?.id ?? "");

  const createMutation = useMutation({
    mutationFn: () =>
      apiClient("/v1/deals", {
        method: "POST",
        body: JSON.stringify({
          name,
          pipelineId: effectivePipelineId,
          stageId: effectiveStageId,
          leadId: leadId || undefined,
          value: value ? Number(value) : undefined,
        }),
      }),
    onSuccess: () => {
      setName("");
      setLeadId("");
      setValue("");
      setMessage("Deal created.");
      void queryClient.invalidateQueries({ queryKey: ["deals"] });
    },
    onError: (err: Error) => setMessage(err.message),
  });

  const statusMutation = useMutation({
    mutationFn: (params: { id: string; status: "won" | "lost" | "open" }) =>
      apiClient(`/v1/deals/${params.id}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status: params.status }),
      }),
    onSuccess: () => {
      setMessage("Deal status updated.");
      void queryClient.invalidateQueries({ queryKey: ["deals"] });
    },
    onError: (err: Error) => setMessage(err.message),
  });

  return (
    <main className="flex flex-1 flex-col gap-6 p-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Deals</h1>
        <p className="text-muted-foreground text-sm">
          Opportunities on your sales pipeline
        </p>
      </div>

      {message ? (
        <p className="bg-muted/40 rounded-md px-3 py-2 text-sm">{message}</p>
      ) : null}

      <section className="border-border space-y-3 rounded-lg border p-4">
        <h2 className="text-sm font-medium">New deal</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Input
            placeholder="Deal name"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <select
            className="border-input bg-background h-9 rounded-md border px-3 text-sm"
            value={effectivePipelineId}
            onChange={(e) => {
              setPipelineId(e.target.value);
              setStageId("");
            }}
          >
            {(pipelinesQuery.data ?? []).map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <select
            className="border-input bg-background h-9 rounded-md border px-3 text-sm"
            value={effectiveStageId}
            onChange={(e) => setStageId(e.target.value)}
          >
            {stages.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
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
            type="number"
            placeholder="Value"
            value={value}
            onChange={(e) => setValue(e.target.value)}
          />
          <Button
            onClick={() => createMutation.mutate()}
            disabled={
              !name.trim() ||
              !effectivePipelineId ||
              !effectiveStageId ||
              createMutation.isPending
            }
          >
            Create
          </Button>
        </div>
      </section>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="text-muted-foreground border-b">
            <tr>
              <th className="py-2 pr-4 font-medium">Name</th>
              <th className="py-2 pr-4 font-medium">Stage</th>
              <th className="py-2 pr-4 font-medium">Lead</th>
              <th className="py-2 pr-4 font-medium">Value</th>
              <th className="py-2 pr-4 font-medium">Status</th>
              <th className="py-2 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {(dealsQuery.data ?? []).map((row) => (
              <tr key={row.id} className="border-b border-border/60">
                <td className="py-2 pr-4 font-medium">{row.name}</td>
                <td className="py-2 pr-4">{row.stage?.name ?? "—"}</td>
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
                  {row.currency} {row.value}
                </td>
                <td className="py-2 pr-4 capitalize">{row.status}</td>
                <td className="py-2">
                  <div className="flex flex-wrap gap-2">
                    {row.status !== "won" ? (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={statusMutation.isPending}
                        onClick={() =>
                          statusMutation.mutate({ id: row.id, status: "won" })
                        }
                      >
                        Won
                      </Button>
                    ) : null}
                    {row.status !== "lost" ? (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={statusMutation.isPending}
                        onClick={() =>
                          statusMutation.mutate({ id: row.id, status: "lost" })
                        }
                      >
                        Lost
                      </Button>
                    ) : null}
                    {row.status !== "open" ? (
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={statusMutation.isPending}
                        onClick={() =>
                          statusMutation.mutate({ id: row.id, status: "open" })
                        }
                      >
                        Reopen
                      </Button>
                    ) : null}
                  </div>
                </td>
              </tr>
            ))}
            {!dealsQuery.data?.length ? (
              <tr>
                <td colSpan={6} className="text-muted-foreground py-6">
                  No deals yet
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </main>
  );
}
