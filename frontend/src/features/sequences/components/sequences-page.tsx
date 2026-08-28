"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { apiClient } from "@/lib/api/client";

type StepChannel = "email" | "whatsapp" | "sms" | "call" | "wait";

type StepDraft = {
  key: string;
  channel: StepChannel;
  delayDays: number;
  subject: string;
  body: string;
};

type SequenceRow = {
  id: string;
  name: string;
  status: string;
  steps: Array<{
    id: string;
    channel: string;
    delayDays: number;
    subject: string | null;
    body: string | null;
  }>;
  _count?: { enrollments: number };
};

type SequenceDetail = SequenceRow & {
  enrollments: Array<{
    id: string;
    status: string;
    nextRunAt: string | null;
    lastError: string | null;
    stoppedReason: string | null;
    lead: {
      id: string;
      email: string | null;
      phone: string | null;
      firstName: string | null;
      lastName: string | null;
    };
    currentStep: {
      id: string;
      channel: string;
      position: number;
      subject: string | null;
      delayDays: number;
    } | null;
  }>;
};

type LeadOption = {
  id: string;
  email: string | null;
  phone: string | null;
  firstName: string | null;
  lastName: string | null;
  pipelineStage?: { name: string } | null;
};

const CHANNELS: { value: StepChannel; label: string }[] = [
  { value: "email", label: "Email (Gmail)" },
  {
    value: "whatsapp",
    label: "WhatsApp",
  },
  { value: "sms", label: "SMS (placeholder)" },
  { value: "call", label: "Call (simulated)" },
  { value: "wait", label: "Wait only" },
];

function newStep(partial?: Partial<StepDraft>): StepDraft {
  return {
    key: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    channel: "email",
    delayDays: 0,
    subject: "",
    body: "",
    ...partial,
  };
}

function leadLabel(lead: {
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  phone?: string | null;
}) {
  return (
    [lead.firstName, lead.lastName].filter(Boolean).join(" ") ||
    lead.email ||
    lead.phone ||
    "Untitled"
  );
}

export function SequencesPage() {
  const queryClient = useQueryClient();
  const [name, setName] = useState("Outbound follow-up");
  const [steps, setSteps] = useState<StepDraft[]>([
    newStep({
      channel: "email",
      delayDays: 0,
      subject: "Quick intro",
      body: "Hi — wanted to introduce ourselves and see if a short chat makes sense.",
    }),
    newStep({
      channel: "whatsapp",
      delayDays: 2,
      body: "Following up on my email — open to a quick call this week?",
    }),
    newStep({
      channel: "email",
      delayDays: 5,
      subject: "Circling back",
      body: "Just bumping this in case it got buried. Happy to close the loop either way.",
    }),
  ]);
  const [enrollSequenceId, setEnrollSequenceId] = useState("");
  const [enrollLeadId, setEnrollLeadId] = useState("");
  const [selectedId, setSelectedId] = useState("");
  const [message, setMessage] = useState<string | null>(null);

  const sequencesQuery = useQuery({
    queryKey: ["sequences"],
    queryFn: () => apiClient<SequenceRow[]>("/v1/sequences"),
  });

  const leadsQuery = useQuery({
    queryKey: ["leads-for-enroll"],
    queryFn: () => apiClient<LeadOption[]>("/v1/leads"),
  });

  const detailQuery = useQuery({
    queryKey: ["sequence", selectedId],
    enabled: Boolean(selectedId),
    queryFn: () => apiClient<SequenceDetail>(`/v1/sequences/${selectedId}`),
  });

  const activeSequences = useMemo(
    () => (sequencesQuery.data ?? []).filter((s) => s.status === "active"),
    [sequencesQuery.data],
  );

  function updateStep(key: string, patch: Partial<StepDraft>) {
    setSteps((prev) =>
      prev.map((s) => (s.key === key ? { ...s, ...patch } : s)),
    );
  }

  function removeStep(key: string) {
    setSteps((prev) => (prev.length <= 1 ? prev : prev.filter((s) => s.key !== key)));
  }

  const createMutation = useMutation({
    mutationFn: async (activate: boolean) => {
      const created = await apiClient<SequenceRow>("/v1/sequences", {
        method: "POST",
        body: JSON.stringify({
          name,
          steps: steps.map((s) => ({
            channel: s.channel,
            delayDays: Number(s.delayDays) || 0,
            subject: s.channel === "email" ? s.subject || undefined : undefined,
            body:
              s.channel === "wait" ? undefined : s.body || undefined,
          })),
        }),
      });
      if (activate) {
        await apiClient(`/v1/sequences/${created.id}/activate`, {
          method: "POST",
        });
      }
      return { created, activate };
    },
    onSuccess: ({ created, activate }) => {
      setMessage(
        activate
          ? `“${created.name}” is active — enroll leads below. Steps run automatically about every 30s.`
          : `Draft “${created.name}” saved. Activate it when ready.`,
      );
      setSelectedId(created.id);
      setEnrollSequenceId(created.id);
      void queryClient.invalidateQueries({ queryKey: ["sequences"] });
    },
    onError: (err: Error) => setMessage(err.message),
  });

  const activateMutation = useMutation({
    mutationFn: (id: string) =>
      apiClient(`/v1/sequences/${id}/activate`, { method: "POST" }),
    onSuccess: () => {
      setMessage("Sequence activated — you can enroll leads now.");
      void queryClient.invalidateQueries({ queryKey: ["sequences"] });
      if (selectedId) {
        void queryClient.invalidateQueries({ queryKey: ["sequence", selectedId] });
      }
    },
    onError: (err: Error) => setMessage(err.message),
  });

  const pauseMutation = useMutation({
    mutationFn: (id: string) =>
      apiClient(`/v1/sequences/${id}/pause`, { method: "POST" }),
    onSuccess: () => {
      setMessage("Sequence paused — due steps will not run.");
      void queryClient.invalidateQueries({ queryKey: ["sequences"] });
      if (selectedId) {
        void queryClient.invalidateQueries({ queryKey: ["sequence", selectedId] });
      }
    },
    onError: (err: Error) => setMessage(err.message),
  });

  const archiveMutation = useMutation({
    mutationFn: (id: string) =>
      apiClient(`/v1/sequences/${id}/archive`, { method: "POST" }),
    onSuccess: () => {
      setMessage("Sequence archived and active enrollments stopped.");
      void queryClient.invalidateQueries({ queryKey: ["sequences"] });
      if (selectedId) {
        void queryClient.invalidateQueries({ queryKey: ["sequence", selectedId] });
      }
    },
    onError: (err: Error) => setMessage(err.message),
  });

  const enrollMutation = useMutation({
    mutationFn: () =>
      apiClient(`/v1/sequences/${enrollSequenceId}/enroll`, {
        method: "POST",
        body: JSON.stringify({ leadId: enrollLeadId }),
      }),
    onSuccess: () => {
      setMessage(
        "Lead enrolled. Day-0 steps run within ~30 seconds, or click Run due steps now.",
      );
      void queryClient.invalidateQueries({ queryKey: ["sequences"] });
      void queryClient.invalidateQueries({
        queryKey: ["sequence", enrollSequenceId],
      });
      setSelectedId(enrollSequenceId);
    },
    onError: (err: Error) => setMessage(err.message),
  });

  const stopMutation = useMutation({
    mutationFn: (enrollmentId: string) =>
      apiClient(`/v1/sequences/enrollments/${enrollmentId}/stop`, {
        method: "POST",
      }),
    onSuccess: () => {
      setMessage("Enrollment stopped.");
      if (selectedId) {
        void queryClient.invalidateQueries({
          queryKey: ["sequence", selectedId],
        });
      }
      void queryClient.invalidateQueries({ queryKey: ["sequences"] });
    },
    onError: (err: Error) => setMessage(err.message),
  });

  const processMutation = useMutation({
    mutationFn: () =>
      apiClient<{ processed: number }>("/v1/sequences/process-due", {
        method: "POST",
      }),
    onSuccess: (res) => {
      setMessage(`Ran ${res.processed ?? 0} due step(s).`);
      void queryClient.invalidateQueries({ queryKey: ["sequences"] });
      if (selectedId) {
        void queryClient.invalidateQueries({
          queryKey: ["sequence", selectedId],
        });
      }
    },
    onError: (err: Error) => setMessage(err.message),
  });

  return (
    <main className="flex flex-1 flex-col gap-6 p-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Sequences</h1>
          <p className="text-muted-foreground text-sm">
            Automated multi-touch follow-ups (email, WhatsApp, SMS, call) for
            enrolled leads. Connect Gmail under Integrations for email steps.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/settings/integrations"
            className="border-border hover:bg-muted inline-flex h-9 items-center rounded-md border px-3 text-sm"
          >
            Integrations
          </Link>
          <Link
            href="/leads"
            className="border-border hover:bg-muted inline-flex h-9 items-center rounded-md border px-3 text-sm"
          >
            Leads
          </Link>
          <Button
            variant="outline"
            onClick={() => processMutation.mutate()}
            disabled={processMutation.isPending}
          >
            Run due steps now
          </Button>
        </div>
      </div>

      {message ? (
        <p className="bg-muted/40 rounded-md px-3 py-2 text-sm">{message}</p>
      ) : null}

      <section className="border-border space-y-4 rounded-lg border p-4">
        <div>
          <h2 className="text-sm font-medium">Build a sequence</h2>
          <p className="text-muted-foreground mt-1 text-xs">
            Delay is days after the previous step (Day 0 = send immediately after
            enroll, within business hours).
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="seq-name">Name</Label>
          <Input
            id="seq-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Outbound follow-up"
          />
        </div>

        <div className="space-y-3">
          {steps.map((step, index) => (
            <div
              key={step.key}
              className="border-border space-y-3 rounded-md border p-3"
            >
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-medium">Step {index + 1}</p>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={steps.length <= 1}
                  onClick={() => removeStep(step.key)}
                >
                  Remove
                </Button>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Channel</Label>
                  <select
                    className="border-input bg-background h-9 w-full rounded-md border px-3 text-sm"
                    value={step.channel}
                    onChange={(e) =>
                      updateStep(step.key, {
                        channel: e.target.value as StepChannel,
                      })
                    }
                  >
                    {CHANNELS.map((c) => (
                      <option key={c.value} value={c.value}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label>Delay (days)</Label>
                  <Input
                    type="number"
                    min={0}
                    value={step.delayDays}
                    onChange={(e) =>
                      updateStep(step.key, {
                        delayDays: Math.max(0, Number(e.target.value) || 0),
                      })
                    }
                  />
                </div>
              </div>
              {step.channel === "email" ? (
                <div className="space-y-2">
                  <Label>Subject</Label>
                  <Input
                    value={step.subject}
                    onChange={(e) =>
                      updateStep(step.key, { subject: e.target.value })
                    }
                    placeholder="Subject line"
                  />
                </div>
              ) : null}
              {step.channel !== "wait" && step.channel !== "call" ? (
                <div className="space-y-2">
                  <Label>Message body</Label>
                  <Textarea
                    rows={3}
                    value={step.body}
                    onChange={(e) =>
                      updateStep(step.key, { body: e.target.value })
                    }
                    placeholder="What to send…"
                  />
                </div>
              ) : null}
              {step.channel === "call" ? (
                <p className="text-muted-foreground text-xs">
                  Places a call via the phone provider (simulated until Twilio
                  Voice is connected).
                </p>
              ) : null}
              {step.channel === "wait" ? (
                <p className="text-muted-foreground text-xs">
                  No message — just waits the delay before the next step.
                </p>
              ) : null}
            </div>
          ))}
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() =>
              setSteps((prev) => [
                ...prev,
                newStep({
                  channel: "email",
                  delayDays: Math.max(
                    1,
                    (prev[prev.length - 1]?.delayDays ?? 0) + 2,
                  ),
                }),
              ])
            }
          >
            Add step
          </Button>
          <Button
            type="button"
            variant="secondary"
            disabled={!name.trim() || !steps.length || createMutation.isPending}
            onClick={() => createMutation.mutate(false)}
          >
            Save draft
          </Button>
          <Button
            type="button"
            disabled={!name.trim() || !steps.length || createMutation.isPending}
            onClick={() => createMutation.mutate(true)}
          >
            Save & activate
          </Button>
        </div>
      </section>

      <section className="border-border space-y-3 rounded-lg border p-4">
        <h2 className="text-sm font-medium">Enroll a lead</h2>
        {!(leadsQuery.data ?? []).length ? (
          <p className="text-muted-foreground text-sm">
            No leads yet.{" "}
            <Link href="/leads" className="underline">
              Add leads first
            </Link>
            .
          </p>
        ) : !activeSequences.length ? (
          <p className="text-muted-foreground text-sm">
            No active sequences. Build one above and click Save & activate.
          </p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-3">
            <select
              className="border-input bg-background rounded-md border px-2 py-2 text-sm"
              value={enrollSequenceId}
              onChange={(e) => {
                setEnrollSequenceId(e.target.value);
                setSelectedId(e.target.value);
              }}
            >
              <option value="">Select sequence</option>
              {activeSequences.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
            <select
              className="border-input bg-background rounded-md border px-2 py-2 text-sm"
              value={enrollLeadId}
              onChange={(e) => setEnrollLeadId(e.target.value)}
            >
              <option value="">Select lead</option>
              {(leadsQuery.data ?? []).map((l) => (
                <option key={l.id} value={l.id}>
                  {leadLabel(l)}
                  {l.pipelineStage?.name ? ` · ${l.pipelineStage.name}` : ""}
                </option>
              ))}
            </select>
            <Button
              onClick={() => enrollMutation.mutate()}
              disabled={
                !enrollSequenceId || !enrollLeadId || enrollMutation.isPending
              }
            >
              Enroll
            </Button>
          </div>
        )}
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="space-y-4">
          {(sequencesQuery.data ?? []).map((seq) => (
            <section
              key={seq.id}
              className={`border-border space-y-3 rounded-lg border p-4 ${
                selectedId === seq.id ? "ring-foreground/20 ring-1" : ""
              }`}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <button
                  type="button"
                  className="text-left"
                  onClick={() => {
                    setSelectedId(seq.id);
                    if (seq.status === "active") setEnrollSequenceId(seq.id);
                  }}
                >
                  <h2 className="font-medium">{seq.name}</h2>
                  <p className="text-muted-foreground text-xs capitalize">
                    {seq.status} · {seq._count?.enrollments ?? 0} enrollments ·{" "}
                    {seq.steps.length} steps
                  </p>
                </button>
                <div className="flex flex-wrap gap-2">
                  {seq.status === "draft" || seq.status === "paused" ? (
                    <Button
                      size="sm"
                      onClick={() => activateMutation.mutate(seq.id)}
                    >
                      Activate
                    </Button>
                  ) : null}
                  {seq.status === "active" ? (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => pauseMutation.mutate(seq.id)}
                    >
                      Pause
                    </Button>
                  ) : null}
                  {seq.status !== "archived" ? (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        if (
                          window.confirm(
                            `Archive “${seq.name}”? Active enrollments will stop.`,
                          )
                        ) {
                          archiveMutation.mutate(seq.id);
                        }
                      }}
                    >
                      Archive
                    </Button>
                  ) : null}
                </div>
              </div>
              <ol className="text-muted-foreground list-decimal space-y-1 pl-5 text-xs">
                {seq.steps.map((step) => (
                  <li key={step.id}>
                    +{step.delayDays}d · {step.channel}
                    {step.subject ? ` — ${step.subject}` : ""}
                  </li>
                ))}
              </ol>
            </section>
          ))}
          {!sequencesQuery.data?.length ? (
            <p className="text-muted-foreground text-sm">
              No sequences yet — build one above.
            </p>
          ) : null}
        </div>

        <section className="border-border space-y-3 rounded-lg border p-4">
          <h2 className="text-sm font-medium">Enrollments</h2>
          {!selectedId ? (
            <p className="text-muted-foreground text-sm">
              Select a sequence to see who is enrolled and stop or inspect
              errors.
            </p>
          ) : detailQuery.isLoading ? (
            <p className="text-muted-foreground text-sm">Loading…</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {(detailQuery.data?.enrollments ?? []).map((e) => (
                <li
                  key={e.id}
                  className="border-border space-y-2 rounded-md border px-3 py-2"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-medium">{leadLabel(e.lead)}</p>
                      <p className="text-muted-foreground text-xs capitalize">
                        {e.status}
                        {e.currentStep
                          ? ` · step: ${e.currentStep.channel}`
                          : ""}
                        {e.nextRunAt
                          ? ` · next ${new Date(e.nextRunAt).toLocaleString()}`
                          : ""}
                      </p>
                      {e.lastError ? (
                        <p className="text-destructive mt-1 text-xs">
                          {e.lastError}
                        </p>
                      ) : null}
                      {e.stoppedReason ? (
                        <p className="text-muted-foreground mt-1 text-xs">
                          Stopped: {e.stoppedReason.replaceAll("_", " ")}
                        </p>
                      ) : null}
                    </div>
                    {e.status === "active" || e.status === "paused" ? (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={stopMutation.isPending}
                        onClick={() => stopMutation.mutate(e.id)}
                      >
                        Stop
                      </Button>
                    ) : null}
                  </div>
                </li>
              ))}
              {!detailQuery.data?.enrollments?.length ? (
                <li className="text-muted-foreground">No enrollments yet</li>
              ) : null}
            </ul>
          )}
        </section>
      </div>
    </main>
  );
}
