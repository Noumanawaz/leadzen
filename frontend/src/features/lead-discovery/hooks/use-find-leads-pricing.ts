"use client";

import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api/client";

export type FindLeadsCostItem = {
  code: string;
  label: string;
  credits: number;
  description: string | null;
};

export type FindLeadsPricing = {
  balance: number;
  costs: FindLeadsCostItem[];
};

export function useFindLeadsPricing() {
  return useQuery({
    queryKey: ["find-leads-credit-costs"],
    queryFn: () =>
      apiClient<FindLeadsPricing>("/v1/leads/find/credit-costs"),
  });
}

export function getCost(
  pricing: FindLeadsPricing | undefined,
  code: string,
): number {
  return pricing?.costs.find((c) => c.code === code)?.credits ?? 0;
}
