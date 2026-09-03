"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { apiClient } from "@/lib/api/client";
import {
  buildEmbedHtml,
  parseLeadFormPresentation,
} from "../lib/lead-form-fields";
import {
  LeadFormCustomizeSheet,
  type LeadFormRecord,
} from "./lead-form-customize-sheet";
import { LeadFormPreview } from "./lead-form-preview";

export function LeadFormsSettingsPage() {
  const qc = useQueryClient();
  const [name, setName] = useState("Website contact");
  const [message, setMessage] = useState<string | null>(null);
  const [editing, setEditing] = useState<LeadFormRecord | null>(null);
  const [customizeOpen, setCustomizeOpen] = useState(false);
  const formsQuery = useQuery({
    queryKey: ["lead-forms"],
    queryFn: () => apiClient<LeadFormRecord[]>("/v1/lead-forms"),
  });

  const createMutation = useMutation({
    mutationFn: () =>
      apiClient<LeadFormRecord>("/v1/lead-forms", {
        method: "POST",
        body: JSON.stringify({ name }),
      }),
    onSuccess: (form) => {
      setMessage(
        `Created. Public URL: ${typeof window !== "undefined" ? window.location.origin : ""}/public/forms/${form.publicId}`,
      );
      setEditing(form);
      setCustomizeOpen(true);
      void qc.invalidateQueries({ queryKey: ["lead-forms"] });
    },
    onError: (e: Error) => setMessage(e.message),
  });

  const apiBase = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api";

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Lead forms</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Public forms POST to the API and create attributed leads.
        </p>
      </div>
      <div className="flex gap-2">
        <Input value={name} onChange={(e) => setName(e.target.value)} />
        <Button
          onClick={() => createMutation.mutate()}
          disabled={createMutation.isPending}
        >
          Create
        </Button>
      </div>
      {message ? <p className="text-sm">{message}</p> : null}
      <ul className="divide-border divide-y rounded-lg border">
        {(formsQuery.data ?? []).map((form) => {
          const presentation = parseLeadFormPresentation(form);
          const submitUrl = `${apiBase}/public/forms/${form.publicId}/submit`;
          const embed = buildEmbedHtml(submitUrl, presentation.fields, {
            submitLabel: presentation.submitLabel,
            honeypot: presentation.honeypot,
          });
          return (
            <li key={form.id} className="space-y-4 p-4 text-sm">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="font-medium">{form.name}</div>
                    <span
                      className={
                        form.isActive
                          ? "rounded-full bg-emerald-500/15 px-2 py-0.5 text-[11px] text-emerald-700 dark:text-emerald-300"
                          : "bg-muted text-muted-foreground rounded-full px-2 py-0.5 text-[11px]"
                      }
                    >
                      {form.isActive ? "Active" : "Inactive"}
                    </span>
                  </div>
                  <div className="text-muted-foreground font-mono text-xs">
                    Frontend: /public/forms/{form.publicId}
                  </div>
                  <div className="text-muted-foreground font-mono text-xs">
                    API: {apiBase}/public/forms/{form.publicId}
                  </div>
                  <div className="text-muted-foreground text-xs">
                    Submissions: {form.submissionCount} · Fields:{" "}
                    {presentation.fields.map((f) => f.label).join(", ")}
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="secondary"
                    onClick={() => {
                      setEditing(form);
                      setCustomizeOpen(true);
                    }}
                  >
                    Customize
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() =>
                      window.open(
                        `/public/forms/${form.publicId}`,
                        "_blank",
                        "noopener,noreferrer",
                      )
                    }
                  >
                    Open
                  </Button>
                </div>
              </div>

              <div className="grid gap-4 lg:grid-cols-2">
                <div className="space-y-2">
                  <div className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
                    Preview
                  </div>
                  <LeadFormPreview presentation={presentation} />
                </div>
                <div className="space-y-2">
                  <div className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
                    Embed snippet
                  </div>
                  <pre className="bg-muted overflow-x-auto rounded-lg p-3 text-xs">
                    {embed}
                  </pre>
                </div>
              </div>
            </li>
          );
        })}
      </ul>

      <LeadFormCustomizeSheet
        form={editing}
        open={customizeOpen}
        onOpenChange={setCustomizeOpen}
      />
    </div>
  );
}

export function ReferralLinksSettingsPage() {
  const qc = useQueryClient();
  const [name, setName] = useState("Partner campaign");
  const [code, setCode] = useState("");
  const listQuery = useQuery({
    queryKey: ["referral-links"],
    queryFn: () =>
      apiClient<
        Array<{
          id: string;
          code: string;
          name: string | null;
          clickCount: number;
          leadCount: number;
        }>
      >("/v1/referral-links"),
  });
  const createMutation = useMutation({
    mutationFn: () =>
      apiClient("/v1/referral-links", {
        method: "POST",
        body: JSON.stringify({ name, code: code || undefined }),
      }),
    onSuccess: () => {
      setCode("");
      void qc.invalidateQueries({ queryKey: ["referral-links"] });
    },
  });
  const apiBase = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api";

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-6">
      <h1 className="text-2xl font-semibold tracking-tight">Referral links</h1>
      <div className="flex flex-wrap gap-2">
        <Input
          placeholder="Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <Input
          placeholder="Code (optional)"
          value={code}
          onChange={(e) => setCode(e.target.value)}
        />
        <Button onClick={() => createMutation.mutate()}>Create</Button>
      </div>
      <ul className="divide-border divide-y rounded-lg border">
        {(listQuery.data ?? []).map((link) => (
          <li key={link.id} className="p-3 text-sm">
            <div className="font-medium">{link.name ?? link.code}</div>
            <div className="text-muted-foreground font-mono text-xs">
              {apiBase}/public/r/{link.code}
            </div>
            <div className="text-muted-foreground text-xs">
              Clicks {link.clickCount} · Leads {link.leadCount}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function ApiKeysSettingsPage() {
  const qc = useQueryClient();
  const [name, setName] = useState("Default ingest key");
  const [secretOnce, setSecretOnce] = useState<string | null>(null);
  const listQuery = useQuery({
    queryKey: ["api-keys"],
    queryFn: () =>
      apiClient<
        Array<{ id: string; name: string; keyPrefix: string; createdAt: string }>
      >("/v1/api-keys"),
  });
  const createMutation = useMutation({
    mutationFn: () =>
      apiClient<{ apiKey: string }>("/v1/api-keys", {
        method: "POST",
        body: JSON.stringify({ name }),
      }),
    onSuccess: (data) => {
      setSecretOnce(data.apiKey);
      void qc.invalidateQueries({ queryKey: ["api-keys"] });
    },
  });
  const revokeMutation = useMutation({
    mutationFn: (id: string) =>
      apiClient(`/v1/api-keys/${id}`, { method: "DELETE" }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["api-keys"] }),
  });

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-6">
      <h1 className="text-2xl font-semibold tracking-tight">API keys</h1>
      <p className="text-muted-foreground text-sm">
        POST /api/public/v1/leads with Authorization: Bearer lms_…
      </p>
      <div className="flex gap-2">
        <Input value={name} onChange={(e) => setName(e.target.value)} />
        <Button onClick={() => createMutation.mutate()}>Create</Button>
      </div>
      {secretOnce ? (
        <div className="rounded-lg border border-amber-500/40 bg-amber-500/15 p-3 text-sm text-amber-950 dark:text-amber-50">
          <p className="font-medium">Copy now — shown once</p>
          <code className="mt-2 block break-all font-mono text-base text-amber-950 dark:text-amber-50">
            {secretOnce}
          </code>
        </div>
      ) : null}
      <ul className="divide-border divide-y rounded-lg border">
        {(listQuery.data ?? []).map((key) => (
          <li
            key={key.id}
            className="flex items-center justify-between gap-2 p-3 text-sm"
          >
            <div>
              <div className="font-medium">{key.name}</div>
              <div className="text-muted-foreground font-mono text-xs">
                {key.keyPrefix}…
              </div>
            </div>
            <Button
              variant="secondary"
              onClick={() => revokeMutation.mutate(key.id)}
            >
              Revoke
            </Button>
          </li>
        ))}
      </ul>
    </div>
  );
}
