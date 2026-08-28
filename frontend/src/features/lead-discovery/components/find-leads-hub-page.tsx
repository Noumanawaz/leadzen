"use client";

import Link from "next/link";
import { useFindLeadsPricing } from "../hooks/use-find-leads-pricing";
import { CreditBalanceBanner } from "./credit-cost-note";

const sources = [
  {
    href: "/leads/find/google-maps",
    title: "Google Maps / Places",
    description: "Find local businesses by category and location.",
    costCodes: ["google_places_search", "google_places_import"],
  },
  {
    href: "/leads/import",
    title: "CSV / Excel import",
    description: "Upload a spreadsheet, map columns, and import leads.",
    costCodes: ["csv_import"],
  },
  {
    href: "/leads/find/apollo",
    title: "Apollo",
    description: "Search people and companies from your Apollo API key.",
    costCodes: ["apollo_search", "apollo_import"],
  },
  {
    href: "/settings/lead-forms",
    title: "Website forms",
    description: "Hosted forms that create leads in your workspace.",
    costCodes: [] as string[],
  },
  {
    href: "/settings/referral-links",
    title: "Referral links",
    description: "Trackable links that attribute inbound leads.",
    costCodes: [] as string[],
  },
  {
    href: "/settings/api-keys",
    title: "Public API",
    description: "Push leads from your systems with an API key.",
    costCodes: [] as string[],
  },
];

export function FindLeadsHubPage() {
  const pricingQuery = useFindLeadsPricing();
  const costByCode = new Map(
    (pricingQuery.data?.costs ?? []).map((c) => [c.code, c]),
  );

  return (
    <div className="mx-auto max-w-4xl space-y-8 p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Find Leads</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Discover and import leads from every source into one CRM pipeline.
        </p>
        <CreditBalanceBanner
          pricing={pricingQuery.data}
          className="text-muted-foreground mt-2 text-sm"
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {sources.map((source) => (
          <Link
            key={source.href}
            href={source.href}
            className="border-border hover:bg-muted/40 block rounded-lg border p-4 transition-colors"
          >
            <div className="font-medium">{source.title}</div>
            <p className="text-muted-foreground mt-1 text-sm">
              {source.description}
            </p>
            {source.costCodes.length > 0 ? (
              <ul className="text-muted-foreground mt-2 space-y-0.5 text-xs">
                {source.costCodes.map((code) => {
                  const item = costByCode.get(code);
                  if (!item) return null;
                  return (
                    <li key={code}>
                      {item.label}: {item.credits} credit
                      {item.credits === 1 ? "" : "s"}
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="text-muted-foreground mt-2 text-xs">Free</p>
            )}
          </Link>
        ))}
      </div>

      <p className="text-muted-foreground text-xs">
        Platform credits are separate from Google Cloud / Apollo API billing.
        Search and import actions debit your workspace balance shown in the
        sidebar.
      </p>
    </div>
  );
}
