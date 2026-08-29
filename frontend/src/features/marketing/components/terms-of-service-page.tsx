import Link from "next/link";
import { LegalFooter } from "./legal-footer";
import { MarketingNav } from "./marketing-nav";

const lastUpdated = "August 29, 2026";
const contactEmail = "noumannawaz2004@gmail.com";

export function TermsOfServicePage() {
  return (
    <div className="marketing-mesh min-h-full text-white">
      <MarketingNav />

      <main className="mx-auto max-w-3xl px-4 pb-24 pt-28 sm:px-6">
        <p className="text-sm text-emerald-400/80">Legal</p>
        <h1 className="font-heading mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">
          Terms of Service
        </h1>
        <p className="mt-3 text-sm text-white/50">Last updated: {lastUpdated}</p>

        <div className="mt-10 space-y-10 text-sm leading-relaxed text-white/70">
          <section className="space-y-3">
            <h2 className="font-heading text-lg font-semibold text-white">
              1. Agreement
            </h2>
            <p>
              These Terms of Service (&quot;Terms&quot;) govern access to and use
              of Lead SaaS (the &quot;Service&quot;) operated by Nouman Nawaz
              (&quot;we&quot;, &quot;us&quot;, or &quot;our&quot;). By creating
              an account or using the Service, you agree to these Terms and our{" "}
              <Link href="/privacy" className="text-emerald-400 hover:underline">
                Privacy Policy
              </Link>
              .
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="font-heading text-lg font-semibold text-white">
              2. The Service
            </h2>
            <p>
              Lead SaaS is a business-to-business lead management and sales
              outreach platform. Features may include lead capture, CRM
              workflows, email outreach, WhatsApp Business messaging through
              connected accounts, billing, and team collaboration. We may
              update, suspend, or discontinue features at any time.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="font-heading text-lg font-semibold text-white">
              3. Accounts and organizations
            </h2>
            <p>
              You must provide accurate registration information and keep your
              credentials secure. You are responsible for activity under your
              account and for users you invite to your organization. You must be
              at least 18 years old and authorized to act on behalf of your
              business.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="font-heading text-lg font-semibold text-white">
              4. Acceptable use
            </h2>
            <p>You agree not to:</p>
            <ul className="list-disc space-y-2 pl-5">
              <li>Violate applicable law or third-party rights</li>
              <li>
                Send spam, unsolicited messages, or messages without proper
                consent (including WhatsApp and email)
              </li>
              <li>
                Misuse integrations such as Meta WhatsApp, Google Gmail, or
                payment providers
              </li>
              <li>
                Attempt to access other customers&apos; data or disrupt the
                Service
              </li>
              <li>Upload malware or attempt unauthorized access to our systems</li>
            </ul>
            <p>
              When using WhatsApp, you must comply with Meta and WhatsApp
              Business policies, including opt-in and template rules.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="font-heading text-lg font-semibold text-white">
              5. Connected accounts and third-party services
            </h2>
            <p>
              The Service may connect to third-party platforms (for example Meta,
              Google, Stripe). Your use of those services is subject to their
              terms. We are not responsible for third-party outages, policy
              changes, or account restrictions imposed by those providers.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="font-heading text-lg font-semibold text-white">
              6. Fees and billing
            </h2>
            <p>
              Paid plans and credit packs are billed as described at checkout.
              Fees are non-refundable except where required by law. We may change
              pricing with reasonable notice. Failure to pay may result in
              suspension.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="font-heading text-lg font-semibold text-white">
              7. Your data
            </h2>
            <p>
              You retain ownership of content and lead data you submit. You
              grant us a limited license to host, process, and display that data
              solely to provide the Service. Our{" "}
              <Link href="/privacy" className="text-emerald-400 hover:underline">
                Privacy Policy
              </Link>{" "}
              explains how we handle personal data. To request deletion, see our{" "}
              <Link
                href="/data-deletion"
                className="text-emerald-400 hover:underline"
              >
                Data deletion instructions
              </Link>
              .
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="font-heading text-lg font-semibold text-white">
              8. Disclaimers
            </h2>
            <p>
              The Service is provided &quot;as is&quot; and &quot;as
              available&quot; without warranties of any kind, whether express or
              implied, including merchantability, fitness for a particular
              purpose, and non-infringement. We do not guarantee delivery of
              messages, lead conversion, or uninterrupted availability.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="font-heading text-lg font-semibold text-white">
              9. Limitation of liability
            </h2>
            <p>
              To the maximum extent permitted by law, we are not liable for
              indirect, incidental, special, consequential, or punitive damages,
              or for loss of profits, data, or goodwill. Our total liability for
              any claim relating to the Service is limited to the amount you
              paid us in the twelve months before the claim, or USD $100 if you
              have not paid fees.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="font-heading text-lg font-semibold text-white">
              10. Termination
            </h2>
            <p>
              You may stop using the Service at any time. We may suspend or
              terminate access if you breach these Terms or if required for
              security or legal reasons. Provisions that by nature should survive
              termination will remain in effect.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="font-heading text-lg font-semibold text-white">
              11. Governing law
            </h2>
            <p>
              These Terms are governed by the laws of Pakistan, without regard
              to conflict-of-law principles, except where mandatory consumer
              protections in your jurisdiction apply.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="font-heading text-lg font-semibold text-white">
              12. Contact
            </h2>
            <p>
              Questions about these Terms:{" "}
              <a
                href={`mailto:${contactEmail}`}
                className="text-emerald-400 underline-offset-2 hover:underline"
              >
                {contactEmail}
              </a>
            </p>
          </section>
        </div>
      </main>

      <LegalFooter />
    </div>
  );
}
