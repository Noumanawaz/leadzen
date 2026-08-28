"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { apiClient } from "@/lib/api/client";

type LeadRow = {
  id: string;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  leadScore: number;
  company?: { name: string } | null;
};

type AiRequestRow = {
  id: string;
  feature: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  creditsUsed: number;
  createdAt: string;
};

type AiResult = {
  id: string;
  feature: string;
  text: string;
  model: string;
  creditsUsed: number;
  score?: number | null;
};

export function AiPage() {
  const queryClient = useQueryClient();
  const [leadId, setLeadId] = useState("");
  const [goal, setGoal] = useState("Book a 15-minute intro call");
  const [companyName, setCompanyName] = useState("");
  const [transcript, setTranscript] = useState("");
  const [inboundMessage, setInboundMessage] = useState("");
  const [result, setResult] = useState<AiResult | null>(null);
  const [copied, setCopied] = useState(false);

  const leadsQuery = useQuery({
    queryKey: ["leads", "ai"],
    queryFn: () => apiClient<LeadRow[]>("/v1/leads"),
  });

  const requestsQuery = useQuery({
    queryKey: ["ai-requests"],
    queryFn: () => apiClient<AiRequestRow[]>("/v1/ai/requests"),
  });

  const run = useMutation({
    mutationFn: async (path: string) => {
      const body =
        path === "company-research"
          ? { companyName }
          : path === "call-summary"
            ? { transcript, leadId: leadId || undefined }
            : path === "generate-email"
              ? { leadId, goal }
              : path === "generate-reply"
                ? { leadId, inboundMessage }
                : { leadId };
      return apiClient<AiResult>(`/v1/ai/${path}`, {
        method: "POST",
        body: JSON.stringify(body),
      });
    },
    onSuccess: (data) => {
      setResult(data);
      setCopied(false);
      void queryClient.invalidateQueries({ queryKey: ["ai-requests"] });
      void queryClient.invalidateQueries({ queryKey: ["leads"] });
    },
  });

  const selected = (leadsQuery.data ?? []).find((l) => l.id === leadId);
  const isStub = Boolean(result?.text?.startsWith("[stub:"));

  return (
    <main className="flex flex-1 flex-col gap-6 p-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">AI assist</h1>
        <p className="text-muted-foreground text-sm">
          Lead summaries, email drafts, scoring, and research — billed per credit
        </p>
      </div>

      <section className="border-border space-y-3 rounded-lg border p-4">
        <h2 className="text-sm font-medium">Lead context</h2>
        <select
          className="border-input bg-background h-9 w-full rounded-md border px-3 text-sm"
          value={leadId}
          onChange={(e) => setLeadId(e.target.value)}
        >
          <option value="">Select a lead…</option>
          {(leadsQuery.data ?? []).map((lead) => (
            <option key={lead.id} value={lead.id}>
              {[lead.firstName, lead.lastName].filter(Boolean).join(" ") ||
                lead.email ||
                lead.id}{" "}
              {lead.company?.name ? `· ${lead.company.name}` : ""}
            </option>
          ))}
        </select>
        {selected ? (
          <p className="text-muted-foreground text-xs">
            Current score: {selected.leadScore}
          </p>
        ) : null}
        <Input
          placeholder="Email goal (optional)"
          value={goal}
          onChange={(e) => setGoal(e.target.value)}
        />
        <div className="flex flex-wrap gap-2">
          <Button
            disabled={!leadId || run.isPending}
            onClick={() => run.mutate("lead-summary")}
          >
            Summarize
          </Button>
          <Button
            disabled={!leadId || run.isPending}
            variant="secondary"
            onClick={() => run.mutate("generate-email")}
          >
            Draft email
          </Button>
          <Button
            disabled={!leadId || run.isPending}
            variant="secondary"
            onClick={() => run.mutate("score-lead")}
          >
            Score lead
          </Button>
        </div>
      </section>

      <section className="border-border space-y-3 rounded-lg border p-4">
        <h2 className="text-sm font-medium">Generate reply</h2>
        <Textarea
          rows={4}
          placeholder="Paste the inbound message from the lead…"
          value={inboundMessage}
          onChange={(e) => setInboundMessage(e.target.value)}
        />
        <Button
          disabled={!leadId || !inboundMessage.trim() || run.isPending}
          onClick={() => run.mutate("generate-reply")}
        >
          Generate reply
        </Button>
      </section>

      <section className="border-border space-y-3 rounded-lg border p-4">
        <h2 className="text-sm font-medium">Company research</h2>
        <Input
          placeholder="Company name"
          value={companyName}
          onChange={(e) => setCompanyName(e.target.value)}
        />
        <Button
          disabled={!companyName || run.isPending}
          onClick={() => run.mutate("company-research")}
        >
          Research
        </Button>
      </section>

      <section className="border-border space-y-3 rounded-lg border p-4">
        <h2 className="text-sm font-medium">Call summary</h2>
        <textarea
          className="border-input bg-background min-h-28 w-full rounded-md border px-3 py-2 text-sm"
          placeholder="Paste call notes or transcript…"
          value={transcript}
          onChange={(e) => setTranscript(e.target.value)}
        />
        <Button
          disabled={!transcript || run.isPending}
          onClick={() => run.mutate("call-summary")}
        >
          Summarize call
        </Button>
      </section>

      {run.isError ? (
        <p className="text-destructive text-sm">
          {(run.error as Error).message || "AI request failed"}
        </p>
      ) : null}

      {result ? (
        <section className="border-border space-y-2 rounded-lg border p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-medium capitalize">
              {result.feature.replaceAll("_", " ")}
            </h2>
            <div className="flex items-center gap-2">
              <p className="text-muted-foreground text-xs">
                {result.model} · {result.creditsUsed} credit
                {result.creditsUsed === 1 ? "" : "s"}
                {typeof result.score === "number"
                  ? ` · score ${result.score}`
                  : ""}
              </p>
              <Button
                size="sm"
                variant="outline"
                onClick={async () => {
                  await navigator.clipboard.writeText(result.text);
                  setCopied(true);
                }}
              >
                {copied ? "Copied" : "Copy draft"}
              </Button>
            </div>
          </div>
          {isStub ? (
            <p className="rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-100">
              GROQ_API_KEY not configured — stub responses
            </p>
          ) : null}
          <pre className="bg-muted/40 whitespace-pre-wrap rounded-md p-3 text-sm">
            {result.text}
          </pre>
        </section>
      ) : null}

      <section className="space-y-2">
        <h2 className="text-sm font-medium">Recent AI usage</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-muted-foreground border-b">
              <tr>
                <th className="py-2 pr-4 font-medium">Feature</th>
                <th className="py-2 pr-4 font-medium">Model</th>
                <th className="py-2 pr-4 font-medium">Tokens</th>
                <th className="py-2 pr-4 font-medium">Credits</th>
                <th className="py-2 font-medium">When</th>
              </tr>
            </thead>
            <tbody>
              {(requestsQuery.data ?? []).map((row) => (
                <tr key={row.id} className="border-b border-border/60">
                  <td className="py-2 pr-4 capitalize">
                    {row.feature.replaceAll("_", " ")}
                  </td>
                  <td className="py-2 pr-4">{row.model}</td>
                  <td className="py-2 pr-4">
                    {row.inputTokens}/{row.outputTokens}
                  </td>
                  <td className="py-2 pr-4">{row.creditsUsed}</td>
                  <td className="py-2">
                    {new Date(row.createdAt).toLocaleString()}
                  </td>
                </tr>
              ))}
              {!requestsQuery.data?.length ? (
                <tr>
                  <td colSpan={5} className="text-muted-foreground py-6">
                    No AI requests yet
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
