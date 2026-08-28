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

type PlaceLead = {
  companyName?: string | null;
  phone?: string | null;
  website?: string | null;
  city?: string | null;
  state?: string | null;
  country?: string | null;
  sourceExternalId?: string | null;
  sourceMetadata?: Record<string, unknown> | null;
  duplicate?: { leadId: string; reason: string } | null;
};

export function GoogleMapsFindPage() {
  const queryClient = useQueryClient();
  const pricingQuery = useFindLeadsPricing();
  const [query, setQuery] = useState("dentists in Austin TX");
  const [results, setResults] = useState<PlaceLead[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [message, setMessage] = useState<string | null>(null);

  const statusQuery = useQuery({
    queryKey: ["google-places-status"],
    queryFn: () =>
      apiClient<{
        ready: boolean;
        platformKeyConfigured: boolean;
        orgOverride: { id: string } | null;
      }>("/v1/integrations/google-places/status"),
  });

  const searchMutation = useMutation({
    mutationFn: () =>
      apiClient<{ results: PlaceLead[]; creditsUsed: number }>(
        "/v1/leads/find/google-maps/search",
        {
          method: "POST",
          body: JSON.stringify({ textQuery: query, maxResultCount: 20 }),
        },
      ),
    onSuccess: (data) => {
      setResults(data.results);
      setSelected(new Set());
      setMessage(
        `Found ${data.results.length} places (${data.creditsUsed} credits used)`,
      );
      void queryClient.invalidateQueries({ queryKey: ["credits"] });
      void queryClient.invalidateQueries({
        queryKey: ["find-leads-credit-costs"],
      });
    },
    onError: (err: Error) => setMessage(err.message),
  });

  const importMutation = useMutation({
    mutationFn: async () => {
      const places = results
        .filter((r) => r.sourceExternalId && selected.has(r.sourceExternalId))
        .map((r) => ({
          sourceExternalId: r.sourceExternalId ?? undefined,
          companyName: r.companyName ?? undefined,
          phone: r.phone ?? undefined,
          website: r.website ?? undefined,
          city: r.city ?? undefined,
          state: r.state ?? undefined,
          country: r.country ?? undefined,
          ...(r.sourceMetadata
            ? { sourceMetadata: r.sourceMetadata }
            : {}),
        }));
      if (!places.length) {
        throw new Error("Select at least one place to import");
      }
      return apiClient<{
        created: number;
        skipped: number;
        failed: number;
        creditsUsed: number;
      }>("/v1/leads/find/google-maps/import", {
        method: "POST",
        body: JSON.stringify({ places }),
      });
    },
    onSuccess: (data) => {
      setMessage(
        `Imported ${data.created}, skipped ${data.skipped}, failed ${data.failed} (${data.creditsUsed} credits used)`,
      );
      void queryClient.invalidateQueries({ queryKey: ["credits"] });
      void queryClient.invalidateQueries({
        queryKey: ["find-leads-credit-costs"],
      });
    },
    onError: (err: Error) => setMessage(err.message),
  });

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const selectableIds = results
    .filter((r) => r.sourceExternalId && !r.duplicate)
    .map((r) => r.sourceExternalId!);
  const allSelected =
    selectableIds.length > 0 && selectableIds.every((id) => selected.has(id));

  function toggleSelectAll() {
    if (allSelected) {
      setSelected(new Set());
      return;
    }
    setSelected(new Set(selectableIds));
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Google Places search
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Uses Places API (New). Search and import debit platform credits.
        </p>
        <CreditBalanceBanner
          pricing={pricingQuery.data}
          className="text-muted-foreground mt-2 text-sm"
        />
        <p className="text-muted-foreground mt-1 text-xs">
          Status:{" "}
          {statusQuery.data?.ready
            ? statusQuery.data.platformKeyConfigured
              ? "Platform key ready"
              : "Org override ready"
            : "Not configured"}
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <Input
          className="min-w-[240px] flex-1"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="e.g. coffee shops in Brooklyn"
        />
        <Button
          onClick={() => searchMutation.mutate()}
          disabled={searchMutation.isPending || !query.trim()}
        >
          {searchMutation.isPending ? "Searching…" : "Search"}
        </Button>
        <Button
          variant="secondary"
          onClick={() => importMutation.mutate()}
          disabled={!selected.size || importMutation.isPending}
        >
          Import selected ({selected.size})
        </Button>
      </div>

      <div className="flex flex-wrap gap-4">
        <CreditCostNote
          pricing={pricingQuery.data}
          code="google_places_search"
          prefix="Search:"
        />
        <CreditCostNote
          pricing={pricingQuery.data}
          code="google_places_import"
          quantity={selected.size || 1}
          prefix="Import (selected):"
        />
      </div>

      {message ? (
        <p className="text-muted-foreground text-sm">{message}</p>
      ) : null}

      {results.length > 0 ? (
        <div className="flex items-center justify-end">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={!selectableIds.length}
            onClick={toggleSelectAll}
          >
            {allSelected
              ? "Deselect all"
              : `Select all (${selectableIds.length})`}
          </Button>
        </div>
      ) : null}

      <ul className="divide-border divide-y rounded-lg border">
        {results.map((place) => {
          const id = place.sourceExternalId ?? "";
          return (
            <li key={id || place.companyName} className="flex gap-3 p-3 text-sm">
              <input
                type="checkbox"
                checked={id ? selected.has(id) : false}
                disabled={!id || Boolean(place.duplicate)}
                onChange={() => id && toggle(id)}
              />
              <div className="min-w-0 flex-1">
                <div className="font-medium">
                  {place.companyName ?? "Untitled"}
                </div>
                <div className="text-muted-foreground">
                  {[place.city, place.state, place.country]
                    .filter(Boolean)
                    .join(", ") || "—"}
                  {place.phone ? ` · ${place.phone}` : ""}
                  {place.website ? ` · ${place.website}` : ""}
                </div>
                {place.duplicate ? (
                  <div className="text-amber-700 text-xs">
                    Duplicate ({place.duplicate.reason})
                  </div>
                ) : null}
              </div>
            </li>
          );
        })}
        {!results.length ? (
          <li className="text-muted-foreground p-4 text-sm">
            Run a search to see places.
          </li>
        ) : null}
      </ul>
    </div>
  );
}
