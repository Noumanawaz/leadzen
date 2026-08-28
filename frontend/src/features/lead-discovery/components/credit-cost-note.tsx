"use client";

import type { FindLeadsPricing } from "../hooks/use-find-leads-pricing";
import { getCost } from "../hooks/use-find-leads-pricing";

export function CreditBalanceBanner({
  pricing,
  className,
}: {
  pricing: FindLeadsPricing | undefined;
  className?: string;
}) {
  if (!pricing) return null;
  return (
    <p className={className ?? "text-muted-foreground text-xs"}>
      Platform credits:{" "}
      <span className="text-foreground font-medium">{pricing.balance}</span>
    </p>
  );
}

export function CreditCostNote({
  pricing,
  code,
  quantity = 1,
  prefix,
}: {
  pricing: FindLeadsPricing | undefined;
  code: string;
  quantity?: number;
  prefix?: string;
}) {
  const unit = getCost(pricing, code);
  if (!unit) return null;
  const total = unit * quantity;
  return (
    <p className="text-muted-foreground text-xs">
      {prefix ? `${prefix} ` : ""}
      Costs{" "}
      <span className="text-foreground font-medium">
        {total} credit{total === 1 ? "" : "s"}
      </span>
      {quantity > 1 ? ` (${unit} × ${quantity})` : ""}
    </p>
  );
}
