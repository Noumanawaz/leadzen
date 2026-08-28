"use client";

import { AnimatePresence, motion, useInView } from "motion/react";
import {
  Check,
  Clock,
  Inbox,
  MapPin,
  MessageSquare,
  Sparkles,
  Target,
  Upload,
  UserPlus,
  Users,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { usePrefersReducedMotion } from "@/components/motion/use-prefers-reduced-motion";

const LOOP_MS = 8000;

const STAGES = [
  {
    id: "capture",
    label: "Capture",
    sub: "Collect every lead",
    tip: "Bring every lead into one place from maps, Apollo, forms, CSV, and referrals.",
    icon: Inbox,
  },
  {
    id: "enrich",
    label: "Enrich",
    sub: "Complete the picture",
    tip: "Automatically enrich leads with company and contact intelligence.",
    icon: Sparkles,
  },
  {
    id: "qualify",
    label: "AI Qualify",
    sub: "Find your best prospects",
    tip: "Score fit so your team focuses on the opportunities that matter.",
    icon: Target,
  },
  {
    id: "outreach",
    label: "Outreach",
    sub: "Reach with context",
    tip: "Reach prospects through the channels your team already uses.",
    icon: MessageSquare,
  },
  {
    id: "followup",
    label: "Follow Up",
    sub: "Never drop the thread",
    tip: "Sequences keep follow-ups on schedule across email, WhatsApp, and calls.",
    icon: Clock,
  },
  {
    id: "won",
    label: "Customer",
    sub: "Close the loop",
    tip: "High-fit prospects become customers with clear revenue attribution.",
    icon: Check,
  },
] as const;

const SOURCES = [
  {
    id: "maps",
    source: "Google Maps",
    title: "Marketing Agency",
    meta: "New York",
    icon: MapPin,
  },
  {
    id: "apollo",
    source: "Apollo",
    title: "John Smith",
    meta: "VP Sales",
    icon: Users,
  },
  {
    id: "web",
    source: "Website",
    title: "Sarah Johnson",
    meta: "Demo Request",
    icon: UserPlus,
  },
  {
    id: "csv",
    source: "CSV",
    title: "1,240 contacts",
    meta: "Import ready",
    icon: Upload,
  },
  {
    id: "referral",
    source: "Referral",
    title: "Partner lead",
    meta: "Warm intro",
    icon: Users,
  },
] as const;

type Phase =
  | "sources"
  | "capture"
  | "enrich"
  | "qualify"
  | "outreach"
  | "followup"
  | "won"
  | "reset";

function phaseFromElapsed(ms: number): Phase {
  if (ms < 1000) return "sources";
  if (ms < 2000) return "capture";
  if (ms < 3000) return "enrich";
  if (ms < 4000) return "qualify";
  if (ms < 5500) return "outreach";
  if (ms < 6500) return "followup";
  if (ms < 7500) return "won";
  return "reset";
}

function stageActive(phase: Phase, stageId: string) {
  const order = ["capture", "enrich", "qualify", "outreach", "followup", "won"];
  const pi = order.indexOf(
    phase === "sources" || phase === "reset" ? "capture" : phase,
  );
  const si = order.indexOf(stageId);
  if (phase === "sources" || phase === "reset") return false;
  return si <= pi;
}

function usePipelineAnimation() {
  const reduced = usePrefersReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { amount: 0.2 });
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (reduced) return;
    let frame: number;
    let last = performance.now();

    const tick = (now: number) => {
      const speed = inView ? 1.15 : 1;
      const delta = (now - last) * speed;
      last = now;
      setElapsed((prev) => {
        const next = prev + delta;
        return next >= LOOP_MS ? next % LOOP_MS : next;
      });
      frame = requestAnimationFrame(tick);
    };

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [reduced, inView]);

  const phase: Phase = reduced ? "won" : phaseFromElapsed(elapsed);
  const captureCount =
    reduced || phase === "sources"
      ? 1240
      : Math.min(1248, 1240 + Math.floor((elapsed - 1000) / 80));

  return {
    ref,
    inView,
    reduced,
    phase,
    captureCount: Math.max(1240, captureCount),
  };
}

function ScoreRing({
  score,
  label,
  active,
}: {
  score: number;
  label?: string;
  active: boolean;
}) {
  const r = 18;
  const c = 2 * Math.PI * r;
  const offset = c - (score / 100) * c;
  return (
    <div className="flex items-center gap-2">
      <div className="relative size-11">
        <svg viewBox="0 0 44 44" className="size-11 -rotate-90">
          <circle
            cx="22"
            cy="22"
            r={r}
            fill="none"
            stroke="currentColor"
            strokeWidth="3"
            className="text-white/10"
          />
          <motion.circle
            cx="22"
            cy="22"
            r={r}
            fill="none"
            stroke="currentColor"
            strokeWidth="3"
            strokeLinecap="round"
            className="text-emerald-400"
            strokeDasharray={c}
            initial={{ strokeDashoffset: c }}
            animate={{ strokeDashoffset: active ? offset : c }}
            transition={{ duration: 0.7, ease: "easeOut" }}
          />
        </svg>
        <span className="absolute inset-0 flex items-center justify-center text-[10px] font-semibold text-white">
          {score}
        </span>
      </div>
      {label ? (
        <span className="text-[10px] font-medium text-emerald-300/90">
          {label}
        </span>
      ) : null}
    </div>
  );
}

function StageCard({
  stage,
  active,
  highlight,
  children,
  className,
  wide = false,
}: {
  stage: (typeof STAGES)[number];
  active: boolean;
  highlight: boolean;
  children?: React.ReactNode;
  className?: string;
  wide?: boolean;
}) {
  const Icon = stage.icon;
  const [hovered, setHovered] = useState(false);

  return (
    <div
      className={cn("relative", className)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <motion.div
        className={cn(
          "glass-card relative w-full rounded-xl p-4 transition-shadow",
          wide ? "max-w-[320px]" : "md:w-[118px] lg:w-[132px]",
          active && "glow-emerald",
          highlight && "ring-1 ring-emerald-400/50",
        )}
        animate={{
          scale: highlight ? 1.02 : 1,
          opacity: active || highlight ? 1 : 0.55,
        }}
        transition={{ duration: 0.35 }}
      >
        <div className="mb-2 flex items-center gap-2.5">
          <span
            className={cn(
              "flex size-8 shrink-0 items-center justify-center rounded-lg",
              active
                ? "bg-emerald-400/15 text-emerald-300"
                : "bg-white/5 text-white/50",
            )}
          >
            <Icon className="size-4" />
          </span>
          <div>
            <div className="text-sm font-semibold text-white">{stage.label}</div>
            <div className="text-[11px] text-white/45">{stage.sub}</div>
          </div>
        </div>
        {children}
      </motion.div>
      <AnimatePresence>
        {hovered ? (
          <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 4 }}
            className="pointer-events-none absolute top-full left-1/2 z-20 mt-2 w-52 -translate-x-1/2 rounded-lg border border-white/10 bg-zinc-950/95 px-3 py-2 text-[11px] leading-relaxed text-white/70 shadow-xl backdrop-blur-md"
          >
            {stage.tip}
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

function SourceChip({
  source,
  visible,
  index,
}: {
  source: (typeof SOURCES)[number];
  visible: boolean;
  index: number;
}) {
  const Icon = source.icon;
  return (
    <motion.div
      initial={false}
      animate={{
        opacity: visible ? 1 : 0,
        y: visible ? 0 : 10,
        scale: visible ? 1 : 0.92,
      }}
      transition={{ delay: visible ? index * 0.08 : 0, duration: 0.35 }}
      className="glass-card flex min-w-[130px] flex-1 items-start gap-2 rounded-lg px-3 py-2.5 sm:min-w-[140px] sm:flex-none"
    >
      <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-md bg-white/5 text-emerald-300/80">
        <Icon className="size-3.5" />
      </span>
      <div className="min-w-0">
        <div className="text-[9px] tracking-wide text-white/40 uppercase">
          {source.source}
        </div>
        <div className="truncate text-xs font-medium text-white">
          {source.title}
        </div>
        <div className="truncate text-[10px] text-white/45">{source.meta}</div>
      </div>
    </motion.div>
  );
}

/** Compact source strip for the hero */
export function LeadSourceStrip() {
  const { ref, reduced, phase } = usePipelineAnimation();

  return (
    <div
      ref={ref}
      className="relative overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03] p-4 sm:p-5"
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,oklch(0.55_0.14_160/0.12),transparent_55%)]" />
      <p className="relative mb-3 text-center text-[11px] font-medium tracking-wide text-emerald-300/80 uppercase">
        Leads arrive from everywhere
      </p>
      <div className="relative flex flex-wrap justify-center gap-2">
        {SOURCES.map((s, i) => (
          <SourceChip
            key={s.id}
            source={s}
            index={i}
            visible={reduced || phase !== "reset"}
          />
        ))}
      </div>
    </div>
  );
}

function FlowConnector({
  fromLeft,
  active,
}: {
  fromLeft: boolean;
  active: boolean;
}) {
  const path = fromLeft
    ? "M 40 0 C 120 28, 200 36, 280 64"
    : "M 280 0 C 200 28, 120 36, 40 64";

  return (
    <div className="relative h-14 w-full max-w-[320px]" aria-hidden>
      <svg
        viewBox="0 0 320 64"
        className="h-full w-full overflow-visible"
        preserveAspectRatio="none"
      >
        <path
          d={path}
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeDasharray="4 6"
          className="text-emerald-400/25"
        />
        <motion.path
          d={path}
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          className="text-emerald-400/70"
          initial={{ pathLength: 0, opacity: 0 }}
          animate={{
            pathLength: active ? 1 : 0,
            opacity: active ? 1 : 0,
          }}
          transition={{ duration: 0.5, ease: "easeOut" }}
        />
        {active ? (
          <motion.circle
            r="4"
            fill="oklch(0.75 0.16 160)"
            animate={{
              cx: fromLeft ? [40, 280] : [280, 40],
              cy: [0, 64],
            }}
            transition={{
              duration: 0.9,
              ease: "easeInOut",
              repeat: Infinity,
              repeatDelay: 1.2,
            }}
          />
        ) : null}
      </svg>
    </div>
  );
}

function StageContent({
  stageId,
  phase,
  captureCount,
}: {
  stageId: string;
  phase: Phase;
  captureCount: number;
}) {
  const enrichDone =
    phase === "enrich" ||
    ["qualify", "outreach", "followup", "won"].includes(phase);
  const qualifyActive = ["qualify", "outreach", "followup", "won"].includes(
    phase,
  );
  const outreachActive = ["outreach", "followup", "won"].includes(phase);
  const followActive = ["followup", "won"].includes(phase);
  const wonActive = phase === "won";

  switch (stageId) {
    case "capture":
      return (
        <div className="text-xs font-medium text-emerald-300/90">
          + {captureCount.toLocaleString()} Leads
        </div>
      );
    case "enrich":
      return (
        <div
          className={cn(
            "relative overflow-hidden rounded-md bg-white/5 p-2 text-xs leading-snug text-white/70",
            enrichDone && "shimmer",
          )}
        >
          <div className="font-medium text-white">John Smith</div>
          {enrichDone ? (
            <>
              <div>VP Sales · Acme Inc.</div>
              <div className="text-white/45">51–200 · New York</div>
            </>
          ) : (
            <div className="text-white/45">john@company.com</div>
          )}
        </div>
      );
    case "qualify":
      return (
        <div className="flex flex-col gap-1.5">
          <ScoreRing score={92} label="High Fit" active={qualifyActive} />
          <div className="flex gap-1 text-[10px] text-white/35">
            <span>78</span>
            <span>64</span>
            <span className="text-white/25">41↓</span>
          </div>
        </div>
      );
    case "outreach":
      return (
        <div className="space-y-1.5">
          <div className="flex gap-1 text-[10px] text-white/40">
            <span>Gmail</span>
            <span>·</span>
            <span>WA</span>
            <span className="text-white/25">(placeholder)</span>
            <span>·</span>
            <span>SMS</span>
            <span className="text-white/25">(placeholder)</span>
          </div>
          <AnimatePresence mode="wait">
            {outreachActive ? (
              <motion.p
                key={phase === "outreach" ? "msg1" : "msg2"}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="rounded-md bg-white/5 px-2 py-1.5 text-[11px] leading-snug text-white/75"
              >
                {phase === "outreach"
                  ? "Hi John, noticed your team is scaling outbound…"
                  : "Reply received"}
              </motion.p>
            ) : (
              <p className="text-[11px] text-white/35">Waiting…</p>
            )}
          </AnimatePresence>
        </div>
      );
    case "followup":
      return (
        <div className="space-y-1">
          {[
            ["Day 1", "Email"],
            ["Day 3", "Follow-up"],
            ["Day 7", "WhatsApp"],
            ["Day 10", "Call"],
          ].map(([day, channel], i) => {
            const lit = followActive && i <= (wonActive ? 3 : 2);
            return (
              <div key={day} className="flex items-center gap-2 text-[10px]">
                <span
                  className={cn(
                    "size-1.5 rounded-full",
                    lit ? "bg-emerald-400" : "bg-white/20",
                  )}
                />
                <span className={lit ? "text-white/80" : "text-white/35"}>
                  {day}
                </span>
                <span className="text-white/30">{channel}</span>
              </div>
            );
          })}
        </div>
      );
    case "won":
      return (
        <motion.div
          animate={
            wonActive ? { scale: [1, 1.03, 1], opacity: 1 } : { opacity: 0.7 }
          }
          transition={{ duration: 0.6 }}
          className="rounded-md bg-emerald-400/10 px-2.5 py-2"
        >
          <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-300">
            <Check className="size-3.5" /> Customer
          </div>
          <div className="mt-0.5 text-sm font-medium text-white">$24,000</div>
        </motion.div>
      );
    default:
      return null;
  }
}

function ZigzagFlow({
  phase,
  captureCount,
  reduced,
}: {
  phase: Phase;
  captureCount: number;
  reduced: boolean;
}) {
  const activeIndex = useMemo(() => {
    const map: Record<Phase, number> = {
      sources: -1,
      capture: 0,
      enrich: 1,
      qualify: 2,
      outreach: 3,
      followup: 4,
      won: 5,
      reset: -1,
    };
    return map[phase];
  }, [phase]);

  return (
    <div className="relative mx-auto flex w-full max-w-xl flex-col items-center">
      {STAGES.map((stage, index) => {
        const isLeft = index % 2 === 0;
        const connectorActive = activeIndex >= index && index > 0;

        return (
          <div
            key={stage.id}
            className={cn(
              "flex w-full flex-col",
              isLeft ? "items-start" : "items-end",
            )}
          >
            {index > 0 ? (
              <FlowConnector fromLeft={!isLeft} active={connectorActive} />
            ) : null}
            <StageCard
              stage={stage}
              wide
              active={stageActive(phase, stage.id)}
              highlight={phase === stage.id}
              className={cn(
                "w-full sm:w-[min(100%,320px)]",
                isLeft ? "sm:mr-12" : "sm:ml-12",
              )}
            >
              <StageContent
                stageId={stage.id}
                phase={phase}
                captureCount={captureCount}
              />
            </StageCard>
          </div>
        );
      })}
    </div>
  );
}

/** Full-width centered process flow — use as its own landing section */
export function LeadLifecycleFlowSection() {
  const { ref, inView, reduced, phase, captureCount } = usePipelineAnimation();

  return (
    <section
      id="how-it-works"
      ref={ref}
      className="relative border-t border-white/5 py-20 sm:py-28"
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,oklch(0.55_0.14_160/0.08),transparent_65%)]" />

      <div className="relative mx-auto max-w-6xl px-4 sm:px-6">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-[11px] font-medium tracking-[0.2em] text-emerald-300/80 uppercase">
            How it works
          </p>
          <h2 className="font-heading mt-3 text-2xl font-semibold tracking-tight text-white sm:text-3xl">
            One path from lead to customer
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-white/50 sm:text-base">
            Every step connects to the next — capture, enrich, qualify, reach
            out, follow up, and close.
          </p>
        </div>

        <div
          className="relative mx-auto mt-14 max-w-2xl"
          style={{
            opacity: reduced ? 1 : inView ? 1 : 0.85,
            transition: "opacity 0.4s ease",
          }}
        >
          <div className="pointer-events-none absolute top-8 bottom-8 left-1/2 hidden w-px -translate-x-1/2 bg-gradient-to-b from-transparent via-emerald-400/20 to-transparent sm:block" />
          <ZigzagFlow
            phase={phase}
            captureCount={captureCount}
            reduced={reduced}
          />
        </div>
      </div>
    </section>
  );
}

/** @deprecated Use LeadSourceStrip in hero + LeadLifecycleFlowSection on landing */
export function LeadLifecyclePipeline() {
  return <LeadLifecycleFlowSection />;
}
