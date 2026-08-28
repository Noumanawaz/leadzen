"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { apiClient } from "@/lib/api/client";
import {
  CreditBalanceBanner,
  CreditCostNote,
} from "./credit-cost-note";
import { useFindLeadsPricing } from "../hooks/use-find-leads-pricing";

type PersonLead = {
  firstName?: string | null;
  lastName?: string | null;
  email?: string | null;
  phone?: string | null;
  jobTitle?: string | null;
  companyName?: string | null;
  sourceExternalId?: string | null;
  duplicate?: { leadId: string; reason: string } | null;
  [key: string]: unknown;
};

export function ApolloFindPage() {
  const queryClient = useQueryClient();
  const pricingQuery = useFindLeadsPricing();
  const [keywords, setKeywords] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [results, setResults] = useState<PersonLead[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [message, setMessage] = useState<string | null>(null);

  const statusQuery = useQuery({
    queryKey: ["apollo-status"],
    queryFn: () =>
      apiClient<{ connected: boolean }>("/v1/integrations/apollo/status"),
  });

  const connectMutation = useMutation({
    mutationFn: () =>
      apiClient("/v1/integrations/apollo/connect", {
        method: "POST",
        body: JSON.stringify({ apiKey }),
      }),
    onSuccess: () => {
      setApiKey("");
      setMessage("Apollo connected");
      void statusQuery.refetch();
    },
    onError: (err: Error) => setMessage(err.message),
  });

  const searchMutation = useMutation({
    mutationFn: () =>
      apiClient<{ results: PersonLead[]; creditsUsed: number }>(
        "/v1/leads/find/apollo/search",
        {
          method: "POST",
          body: JSON.stringify({ qKeywords: keywords }),
        },
      ),
    onSuccess: (data) => {
      setResults(data.results);
      setSelected(new Set());
      setMessage(
        `Found ${data.results.length} people (${data.creditsUsed} credits used)`,
      );
      void queryClient.invalidateQueries({ queryKey: ["credits"] });
      void queryClient.invalidateQueries({
        queryKey: ["find-leads-credit-costs"],
      });
    },
    onError: (err: Error) => setMessage(err.message),
  });

  const importMutation = useMutation({
    mutationFn: () => {
      const people = results.filter(
        (r) => r.sourceExternalId && selected.has(String(r.sourceExternalId)),
      );
      return apiClient<{
        created: number;
        skipped: number;
        creditsUsed: number;
      }>("/v1/leads/find/apollo/import", {
        method: "POST",
        body: JSON.stringify({
          people: people.map((p) => ({
            id: p.sourceExternalId,
            first_name: p.firstName,
            last_name: p.lastName,
            email: p.email,
            phone_number: p.phone,
            title: p.jobTitle,
            organization: { name: p.companyName },
          })),
        }),
      });
    },
    onSuccess: (data) => {
      setMessage(
        `Imported ${data.created}, skipped ${data.skipped} (${data.creditsUsed} credits used)`,
      );
      void queryClient.invalidateQueries({ queryKey: ["credits"] });
      void queryClient.invalidateQueries({
        queryKey: ["find-leads-credit-costs"],
      });
    },
    onError: (err: Error) => setMessage(err.message),
  });

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Apollo</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Connect your Apollo API key, search, then import selected people.
          Search and import debit platform credits.
        </p>
        <CreditBalanceBanner
          pricing={pricingQuery.data}
          className="text-muted-foreground mt-2 text-sm"
        />
      </div>

      {!statusQuery.data?.connected ? (
        <div className="flex flex-wrap gap-2">
          <Input
            type="password"
            placeholder="Apollo API key"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            className="min-w-[240px] flex-1"
          />
          <Button
            onClick={() => connectMutation.mutate()}
            disabled={!apiKey || connectMutation.isPending}
          >
            Connect
          </Button>
        </div>
      ) : (
        <p className="text-sm text-emerald-700">Apollo connected</p>
      )}

      <div className="flex flex-wrap gap-2">
        <Input
          className="min-w-[240px] flex-1"
          value={keywords}
          onChange={(e) => setKeywords(e.target.value)}
          placeholder="Keywords (e.g. SaaS founder)"
        />
        <Button
          onClick={() => searchMutation.mutate()}
          disabled={searchMutation.isPending}
        >
          Search
        </Button>
        <Button
          variant="secondary"
          disabled={!selected.size || importMutation.isPending}
          onClick={() => importMutation.mutate()}
        >
          Import ({selected.size})
        </Button>
      </div>

      <div className="flex flex-wrap gap-4">
        <CreditCostNote
          pricing={pricingQuery.data}
          code="apollo_search"
          prefix="Search:"
        />
        <CreditCostNote
          pricing={pricingQuery.data}
          code="apollo_import"
          quantity={selected.size || 1}
          prefix="Import (selected):"
        />
      </div>

      {message ? (
        <p className="text-muted-foreground text-sm">{message}</p>
      ) : null}

      <ul className="divide-border divide-y rounded-lg border">
        {results.map((person) => {
          const id = String(person.sourceExternalId ?? "");
          return (
            <li key={id || person.email} className="flex gap-3 p-3 text-sm">
              <input
                type="checkbox"
                checked={id ? selected.has(id) : false}
                disabled={!id || Boolean(person.duplicate)}
                onChange={() => {
                  setSelected((prev) => {
                    const next = new Set(prev);
                    if (next.has(id)) next.delete(id);
                    else next.add(id);
                    return next;
                  });
                }}
              />
              <div>
                <div className="font-medium">
                  {[person.firstName, person.lastName].filter(Boolean).join(" ") ||
                    person.email ||
                    "Unknown"}
                </div>
                <div className="text-muted-foreground">
                  {[person.jobTitle, person.companyName, person.email]
                    .filter(Boolean)
                    .join(" · ")}
                </div>
                {person.duplicate ? (
                  <div className="text-xs text-amber-700">
                    Duplicate ({person.duplicate.reason})
                  </div>
                ) : null}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
