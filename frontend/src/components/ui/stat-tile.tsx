"use client";

import { motion } from "motion/react";
import { cn } from "@/lib/utils";
import { HoverLift } from "@/components/motion/hover-lift";
import { usePrefersReducedMotion } from "@/components/motion/use-prefers-reduced-motion";

export function StatTile({
  label,
  value,
  hint,
  delay = 0,
}: {
  label: string;
  value: React.ReactNode;
  hint?: string;
  delay?: number;
}) {
  const reduced = usePrefersReducedMotion();

  const inner = (
    <HoverLift>
      <div className="surface-elevated rounded-xl p-4">
        <div className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
          {label}
        </div>
        <div className="mt-2 font-heading text-2xl font-semibold tracking-tight">
          {value}
        </div>
        {hint ? (
          <div className="text-muted-foreground mt-1 text-xs">{hint}</div>
        ) : null}
      </div>
    </HoverLift>
  );

  if (reduced) return inner;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay, ease: [0.22, 1, 0.36, 1] }}
      className={cn()}
    >
      {inner}
    </motion.div>
  );
}
