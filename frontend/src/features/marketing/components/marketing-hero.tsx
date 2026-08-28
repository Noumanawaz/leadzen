"use client";

import Link from "next/link";
import { FadeIn } from "@/components/motion/fade-in";
import { LeadSourceStrip } from "./lead-lifecycle-pipeline";

export function MarketingHero() {
  return (
    <section className="relative overflow-hidden pt-24 pb-16 sm:pt-28 sm:pb-20">
      <div className="pointer-events-none absolute inset-0 marketing-mesh" />
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_bottom,transparent_60%,oklch(0.14_0.025_170)_100%)]" />

      <div className="relative mx-auto grid max-w-6xl gap-10 px-4 sm:px-6 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.15fr)] lg:items-center lg:gap-12">
        <div className="flex flex-col gap-6">
          <FadeIn>
            <p className="font-heading text-3xl font-semibold tracking-tight text-white sm:text-4xl md:text-5xl">
              Lead SaaS
            </p>
          </FadeIn>
          <FadeIn delay={0.08}>
            <h1 className="font-heading text-3xl leading-[1.1] font-semibold tracking-tight text-white sm:text-4xl lg:text-[2.75rem]">
              From Lead to Customer, Automatically.
            </h1>
          </FadeIn>
          <FadeIn delay={0.14}>
            <p className="max-w-md text-base leading-relaxed text-white/60 sm:text-lg">
              Find prospects, enrich their data, qualify the best opportunities,
              and reach them through the channels that work — all from one
              platform.
            </p>
          </FadeIn>
          <FadeIn delay={0.2}>
            <div className="flex flex-wrap items-center gap-3">
              <Link
                href="/register"
                className="inline-flex h-11 items-center rounded-md bg-emerald-500 px-5 text-sm font-medium text-zinc-950 transition-colors hover:bg-emerald-400"
              >
                Start for Free
              </Link>
              <a
                href="#how-it-works"
                className="inline-flex h-11 items-center rounded-md border border-white/15 bg-white/5 px-5 text-sm font-medium text-white transition-colors hover:bg-white/10"
              >
                See How It Works
              </a>
            </div>
            <p className="mt-3 text-sm text-white/40">No credit card required</p>
          </FadeIn>
        </div>

        <FadeIn delay={0.18} y={20} className="min-w-0">
          <LeadSourceStrip />
        </FadeIn>
      </div>
    </section>
  );
}
