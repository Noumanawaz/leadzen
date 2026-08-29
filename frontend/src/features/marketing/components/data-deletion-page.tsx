import { LegalFooter } from "./legal-footer";
import { MarketingNav } from "./marketing-nav";

const lastUpdated = "August 29, 2026";
const contactEmail = "noumannawaz2004@gmail.com";

export function DataDeletionPage() {
  return (
    <div className="marketing-mesh min-h-full text-white">
      <MarketingNav />

      <main className="mx-auto max-w-3xl px-4 pb-24 pt-28 sm:px-6">
        <p className="text-sm text-emerald-400/80">Legal</p>
        <h1 className="font-heading mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">
          Data Deletion Instructions
        </h1>
        <p className="mt-3 text-sm text-white/50">Last updated: {lastUpdated}</p>

        <div className="mt-10 space-y-10 text-sm leading-relaxed text-white/70">
          <section className="space-y-3">
            <h2 className="font-heading text-lg font-semibold text-white">
              Overview
            </h2>
            <p>
              Lead SaaS is operated by Nouman Nawaz. This page explains how to
              request deletion of personal data we hold about you, including
              data received from Meta when you connect WhatsApp or complete
              Facebook Login during Embedded Signup.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="font-heading text-lg font-semibold text-white">
              Option 1 — Delete from your account (recommended)
            </h2>
            <p>If you have an active Lead SaaS account:</p>
            <ol className="list-decimal space-y-2 pl-5">
              <li>Sign in to your organization.</li>
              <li>
                Go to <strong className="text-white/90">Settings → Integrations</strong>{" "}
                and disconnect WhatsApp or Gmail if connected.
              </li>
              <li>
                Organization administrators can use in-app privacy tools (where
                available) to export or request deletion of organization data.
              </li>
              <li>
                To delete your user account entirely, email us from your
                registered address (see Option 2).
              </li>
            </ol>
          </section>

          <section className="space-y-3">
            <h2 className="font-heading text-lg font-semibold text-white">
              Option 2 — Email deletion request
            </h2>
            <p>
              Send an email to{" "}
              <a
                href={`mailto:${contactEmail}?subject=Lead%20SaaS%20Data%20Deletion%20Request`}
                className="text-emerald-400 underline-offset-2 hover:underline"
              >
                {contactEmail}
              </a>{" "}
              with the subject line{" "}
              <strong className="text-white/90">Lead SaaS Data Deletion Request</strong>
              . Include:
            </p>
            <ul className="list-disc space-y-2 pl-5">
              <li>Your full name</li>
              <li>The email address associated with your Lead SaaS account</li>
              <li>Your organization name (if applicable)</li>
              <li>Whether you want partial deletion or full account deletion</li>
              <li>
                If requesting Meta-related data deletion, note that you
                connected WhatsApp via Lead SaaS
              </li>
            </ul>
            <p>
              We will verify your identity and respond within 30 days, or
              sooner where required by law.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="font-heading text-lg font-semibold text-white">
              What we delete
            </h2>
            <p>Upon a verified request, we delete or anonymize, where applicable:</p>
            <ul className="list-disc space-y-2 pl-5">
              <li>Account profile information (name, email)</li>
              <li>Organization membership and role data</li>
              <li>Encrypted WhatsApp/Gmail connection tokens and integration metadata</li>
              <li>Message history and CRM records tied to your organization</li>
              <li>Activity logs associated with your account</li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="font-heading text-lg font-semibold text-white">
              What may be retained
            </h2>
            <p>
              We may retain limited information where required for legal,
              security, fraud prevention, or billing obligations (for example
              invoice records). Backup copies may persist for a short period
              before automatic purge.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="font-heading text-lg font-semibold text-white">
              Meta / Facebook data
            </h2>
            <p>
              If you connected WhatsApp through Meta Embedded Signup, disconnect
              the integration in Settings → Integrations before or as part of
              your deletion request. We will delete stored Meta access tokens,
              WABA identifiers, and related message data from our systems. Data
              held by Meta on Meta&apos;s platforms is subject to Meta&apos;s own
              deletion tools and policies.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="font-heading text-lg font-semibold text-white">
              Contact
            </h2>
            <p>
              Data controller: <strong className="text-white/90">Nouman Nawaz</strong>
              <br />
              Email:{" "}
              <a
                href={`mailto:${contactEmail}`}
                className="text-emerald-400 underline-offset-2 hover:underline"
              >
                {contactEmail}
              </a>
              <br />
              Address: House no 23, Street 10, Bahria Hamlet, Rawalpindi, Punjab
              44000, Pakistan
            </p>
          </section>
        </div>
      </main>

      <LegalFooter />
    </div>
  );
}
