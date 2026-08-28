"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import {
  useMemo,
  useRef,
  useState,
  type DragEvent,
} from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { apiClient } from "@/lib/api/client";
import { cn } from "@/lib/utils";
import { useGlobalLoaderEffect } from "@/components/global-loader";

type Stage = { id: string; name: string; position: number };
type Pipeline = {
  id: string;
  name: string;
  isDefault: boolean;
  stages: Stage[];
};

type LeadCard = {
  id: string;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  phone: string | null;
  leadScore: number;
  pipelineId: string | null;
  pipelineStageId: string | null;
  company?: { name: string } | null;
};

const UNASSIGNED = "unassigned";
const BOARD_QUERY_KEY = ["leads", "board-all"] as const;

function leadLabel(lead: LeadCard) {
  return (
    [lead.firstName, lead.lastName].filter(Boolean).join(" ") ||
    lead.email ||
    lead.company?.name ||
    lead.phone ||
    "Lead"
  );
}

function leadColumnId(
  lead: LeadCard,
  stageIds: Set<string>,
): string {
  if (lead.pipelineStageId && stageIds.has(lead.pipelineStageId)) {
    return lead.pipelineStageId;
  }
  return UNASSIGNED;
}

export function PipelinesPage() {
  const queryClient = useQueryClient();
  const [quickEmail, setQuickEmail] = useState("");
  const [quickName, setQuickName] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<string | null>(null);
  const dragLeadIdRef = useRef<string | null>(null);

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

  const pipeline = pipelinesQuery.data?.[0];
  const stageIds = useMemo(
    () => new Set((pipeline?.stages ?? []).map((s) => s.id)),
    [pipeline?.stages],
  );

  const leadsQuery = useQuery({
    queryKey: [...BOARD_QUERY_KEY],
    queryFn: () => apiClient<LeadCard[]>("/v1/leads"),
  });

  const byColumn = useMemo(() => {
    const map = new Map<string, LeadCard[]>();
    for (const stage of pipeline?.stages ?? []) map.set(stage.id, []);
    const unassigned: LeadCard[] = [];

    for (const lead of leadsQuery.data ?? []) {
      const columnId = leadColumnId(lead, stageIds);
      if (columnId === UNASSIGNED) {
        unassigned.push(lead);
      } else {
        map.get(columnId)!.push(lead);
      }
    }
    return { map, unassigned };
  }, [leadsQuery.data, pipeline?.stages, stageIds]);

  useGlobalLoaderEffect(
    "pipelines-board",
    (pipelinesQuery.isLoading && !pipelinesQuery.data) ||
      (Boolean(pipeline) && leadsQuery.isLoading && !leadsQuery.data),
    "Loading pipeline board…",
  );

  const ensureMutation = useMutation({
    mutationFn: () =>
      apiClient("/v1/pipelines/ensure-default", { method: "POST" }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["pipelines"] });
    },
  });

  const moveMutation = useMutation({
    mutationFn: (params: { leadId: string; stageId: string }) => {
      if (params.stageId === UNASSIGNED) {
        return apiClient(`/v1/leads/${params.leadId}`, {
          method: "PATCH",
          body: JSON.stringify({
            pipelineStageId: "unassigned",
          }),
        });
      }
      return apiClient(`/v1/leads/${params.leadId}`, {
        method: "PATCH",
        body: JSON.stringify({
          pipelineId: pipeline!.id,
          pipelineStageId: params.stageId,
        }),
      });
    },
    onMutate: async (params) => {
      await queryClient.cancelQueries({ queryKey: [...BOARD_QUERY_KEY] });
      const previous = queryClient.getQueryData<LeadCard[]>([
        ...BOARD_QUERY_KEY,
      ]);

      queryClient.setQueryData<LeadCard[]>([...BOARD_QUERY_KEY], (old) => {
        if (!old) return old;
        return old.map((lead) => {
          if (lead.id !== params.leadId) return lead;
          if (params.stageId === UNASSIGNED) {
            return { ...lead, pipelineStageId: null };
          }
          return {
            ...lead,
            pipelineId: pipeline?.id ?? lead.pipelineId,
            pipelineStageId: params.stageId,
          };
        });
      });

      return { previous };
    },
    onSuccess: (_data, vars) => {
      setMessage(
        vars.stageId === UNASSIGNED
          ? "Lead moved to Unassigned."
          : "Lead moved.",
      );
    },
    onError: (err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData([...BOARD_QUERY_KEY], context.previous);
      }
      setMessage((err as Error).message);
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ["leads"] });
    },
  });

  const createMutation = useMutation({
    mutationFn: () => {
      const [firstName, ...rest] = quickName.trim().split(/\s+/);
      const lastName = rest.join(" ") || undefined;
      const firstStage = pipeline?.stages[0];
      return apiClient("/v1/leads", {
        method: "POST",
        body: JSON.stringify({
          email: quickEmail,
          firstName: firstName || undefined,
          lastName,
          source: "pipeline_board",
          pipelineId: pipeline?.id,
          pipelineStageId: firstStage?.id,
        }),
      });
    },
    onSuccess: () => {
      setQuickEmail("");
      setQuickName("");
      setMessage("Lead added to New stage.");
      void queryClient.invalidateQueries({ queryKey: ["leads"] });
    },
    onError: (err) => setMessage((err as Error).message),
  });

  function onDragStart(e: DragEvent, leadId: string) {
    dragLeadIdRef.current = leadId;
    e.dataTransfer.setData("text/plain", leadId);
    e.dataTransfer.effectAllowed = "move";
    setDraggingId(leadId);
  }

  function onDragEnd() {
    dragLeadIdRef.current = null;
    setDraggingId(null);
    setDropTarget(null);
  }

  function allowDrop(e: DragEvent) {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  }

  function onDragEnterColumn(e: DragEvent, columnId: string) {
    allowDrop(e);
    setDropTarget(columnId);
  }

  function onDragLeaveColumn(e: DragEvent, columnId: string) {
    const related = e.relatedTarget as Node | null;
    const current = e.currentTarget as Node;
    if (related && current.contains(related)) return;
    setDropTarget((t) => (t === columnId ? null : t));
  }

  function onDropColumn(e: DragEvent, columnId: string) {
    e.preventDefault();
    e.stopPropagation();

    const leadId =
      e.dataTransfer.getData("text/plain") ||
      dragLeadIdRef.current ||
      draggingId ||
      "";

    setDropTarget(null);
    setDraggingId(null);
    dragLeadIdRef.current = null;

    if (!leadId || !pipeline) return;

    const lead = leadsQuery.data?.find((l) => l.id === leadId);
    if (!lead) return;

    const fromColumn = leadColumnId(lead, stageIds);
    if (fromColumn === columnId) return;

    moveMutation.mutate({ leadId, stageId: columnId });
  }

  const columns: Array<{ id: string; name: string; cards: LeadCard[] }> = [
    {
      id: UNASSIGNED,
      name: "Unassigned",
      cards: byColumn.unassigned,
    },
    ...(pipeline?.stages ?? []).map((stage) => ({
      id: stage.id,
      name: stage.name,
      cards: byColumn.map.get(stage.id) ?? [],
    })),
  ];

  return (
    <main className="flex flex-1 flex-col gap-6 p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Pipelines</h1>
          <p className="text-muted-foreground text-sm">
            Drag leads between columns — Unassigned holds leads with no stage
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/leads"
            className="border-border hover:bg-muted inline-flex h-9 items-center rounded-md border px-3 text-sm"
          >
            All leads
          </Link>
          <Button
            variant="outline"
            onClick={() => ensureMutation.mutate()}
            disabled={ensureMutation.isPending}
          >
            Ensure default pipeline
          </Button>
        </div>
      </div>

      {message ? (
        <p className="bg-muted/40 rounded-md px-3 py-2 text-sm">{message}</p>
      ) : null}

      {pipeline ? (
        <section className="border-border space-y-3 rounded-lg border p-4">
          <h2 className="text-sm font-medium">
            Quick add to {pipeline.name}
            {pipeline.isDefault ? " (default)" : ""}
          </h2>
          <div className="grid gap-3 sm:grid-cols-3">
            <Input
              placeholder="Name"
              value={quickName}
              onChange={(e) => setQuickName(e.target.value)}
            />
            <Input
              placeholder="Email *"
              value={quickEmail}
              onChange={(e) => setQuickEmail(e.target.value)}
            />
            <Button
              onClick={() => createMutation.mutate()}
              disabled={!quickEmail || createMutation.isPending}
            >
              Add to board
            </Button>
          </div>
        </section>
      ) : null}

      {!pipeline && !pipelinesQuery.isLoading ? (
        <p className="text-muted-foreground text-sm">
          No pipeline yet. Click “Ensure default pipeline”.
        </p>
      ) : null}

      {pipeline ? (
        <div className="flex gap-3 overflow-x-auto pb-2">
          {columns.map((column) => (
            <section
              key={column.id}
              className={cn(
                "border-border flex w-64 shrink-0 flex-col rounded-lg border transition-colors",
                column.id === UNASSIGNED ? "bg-muted/35" : "bg-muted/20",
                dropTarget === column.id &&
                  "border-foreground/40 bg-muted/50 ring-foreground/15 ring-2",
              )}
            >
              <header className="border-border flex items-center justify-between border-b px-3 py-2">
                <h3 className="text-sm font-medium">{column.name}</h3>
                <span className="text-muted-foreground text-xs">
                  {column.cards.length}
                </span>
              </header>
              <div
                className="flex min-h-40 flex-1 flex-col gap-2 p-2"
                onDragEnter={(e) => onDragEnterColumn(e, column.id)}
                onDragOver={allowDrop}
                onDragLeave={(e) => onDragLeaveColumn(e, column.id)}
                onDrop={(e) => onDropColumn(e, column.id)}
              >
                {column.cards.map((lead) => (
                  <article
                    key={lead.id}
                    draggable
                    onDragStart={(e) => onDragStart(e, lead.id)}
                    onDragEnd={onDragEnd}
                    onDragOver={allowDrop}
                    onDrop={(e) => onDropColumn(e, column.id)}
                    className={cn(
                      "border-border bg-background cursor-grab space-y-1.5 rounded-md border p-2.5 shadow-xs active:cursor-grabbing",
                      draggingId === lead.id && "opacity-40",
                    )}
                  >
                    <div className="text-muted-foreground text-[10px] tracking-wide uppercase">
                      Drag
                    </div>
                    <div className="text-sm font-medium leading-tight">
                      {leadLabel(lead)}
                    </div>
                    <div className="text-muted-foreground truncate text-xs">
                      {lead.email ?? "No email"}
                      {lead.phone ? ` · ${lead.phone}` : ""}
                      {lead.company?.name && leadLabel(lead) !== lead.company.name
                        ? ` · ${lead.company.name}`
                        : ""}
                    </div>
                  </article>
                ))}
                {!column.cards.length ? (
                  <p className="text-muted-foreground pointer-events-none flex flex-1 items-center justify-center px-1 py-6 text-center text-xs">
                    {dropTarget === column.id
                      ? "Drop here"
                      : "Drop leads here"}
                  </p>
                ) : null}
              </div>
            </section>
          ))}
        </div>
      ) : null}
    </main>
  );
}
