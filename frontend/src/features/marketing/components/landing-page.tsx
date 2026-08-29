"use client";

import Link from "next/link";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { FadeIn } from "@/components/motion/fade-in";
import { authStorage } from "@/lib/auth/auth-storage";
import { LeadLifecycleFlowSection } from "./lead-lifecycle-pipeline";
import { MarketingHero } from "./marketing-hero";
import { MarketingNav } from "./marketing-nav";

const promises = [
  {
    title: "Discover anywhere",
    body: "Maps, Apollo, forms, CSV, and referrals land in one capture stream.",
  },
  {
    title: "Enrich & qualify",
    body: "AI completes the profile and scores fit so you chase the right deals.",
  },
  {
    title: "Outreach that converts",
    body: "Email sequences run for real. WhatsApp uses your connected Meta Business account. SMS and calls remain placeholders until providers are connected.",
  },
];

export function LandingPage() {
  const router = useRouter();

  useEffect(() => {
    if (authStorage.getAccessToken()) {
      router.replace("/dashboard");
    }
  }, [router]);

  return (
    <div className="marketing-mesh min-h-full text-white">
      <MarketingNav />
      <MarketingHero />

      <LeadLifecycleFlowSection />

      <section className="relative border-t border-white/5 py-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <FadeIn>
            <h2 className="font-heading max-w-xl text-2xl font-semibold tracking-tight sm:text-3xl">
              Your leads come from anywhere. One workflow takes them to closed.
            </h2>
            <p className="mt-3 max-w-2xl text-white/55">
              Discover → Enrich → Qualify → Outreach → Convert — without
              stitching five tools together.
            </p>
          </FadeIn>
          <div className="mt-12 grid gap-8 sm:grid-cols-3">
            {promises.map((item, i) => (
              <FadeIn key={item.title} delay={0.08 * i}>
                <div className="border-t border-emerald-400/25 pt-5">
                  <h3 className="font-heading text-lg font-semibold text-white">
                    {item.title}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-white/50">
                    {item.body}
                  </p>
                </div>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      <section className="relative border-t border-white/5 py-20">
        <FadeIn>
          <div className="mx-auto flex max-w-6xl flex-col items-start gap-5 px-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
            <div>
              <h2 className="font-heading text-2xl font-semibold tracking-tight sm:text-3xl">
                Ready to turn every lead into an opportunity?
              </h2>
              <p className="mt-2 text-white/50">
                Start free. Invite your team when you&apos;re ready.
              </p>
            </div>
            <Link
              href="/register"
              className="inline-flex h-11 shrink-0 items-center rounded-md bg-emerald-500 px-5 text-sm font-medium text-zinc-950 transition-colors hover:bg-emerald-400"
            >
              Start for Free
            </Link>
          </div>
        </FadeIn>
      </section>

      <footer className="border-t border-white/5 py-8">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 text-sm text-white/35 sm:px-6">
          <span className="font-heading font-medium text-white/50">Lead SaaS</span>
          <div className="flex flex-wrap gap-4">
            <Link href="/privacy" className="hover:text-white/70">
              Privacy
            </Link>
            <Link href="/terms" className="hover:text-white/70">
              Terms
            </Link>
            <Link href="/data-deletion" className="hover:text-white/70">
              Data deletion
            </Link>
            <Link href="/login" className="hover:text-white/70">
              Sign in
            </Link>
            <Link href="/register" className="hover:text-white/70">
              Register
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
