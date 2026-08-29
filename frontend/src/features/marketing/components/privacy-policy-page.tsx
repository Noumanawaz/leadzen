import Link from "next/link";
import { MarketingNav } from "./marketing-nav";

const lastUpdated = "August 29, 2026";

export function PrivacyPolicyPage() {
  return (
    <div className="marketing-mesh min-h-full text-white">
      <MarketingNav />

      <main className="mx-auto max-w-3xl px-4 pb-24 pt-28 sm:px-6">
        <p className="text-sm text-emerald-400/80">Legal</p>
        <h1 className="font-heading mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">
          Privacy Policy
        </h1>
        <p className="mt-3 text-sm text-white/50">Last updated: {lastUpdated}</p>

        <div className="mt-10 space-y-10 text-sm leading-relaxed text-white/70">
          <section className="space-y-3">
            <h2 className="font-heading text-lg font-semibold text-white">
              1. Who we are
            </h2>
            <p>
              Lead SaaS (&quot;we&quot;, &quot;us&quot;, or &quot;our&quot;)
              provides a lead management and outreach platform that helps
              businesses discover, enrich, qualify, and contact prospects. This
              Privacy Policy explains how we collect, use, disclose, and protect
              personal data when you use our website, application, and related
              services (the &quot;Service&quot;), including integrations with
              third-party providers such as Meta (WhatsApp Business Platform)
              and Google (Gmail).
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="font-heading text-lg font-semibold text-white">
              2. Information we collect
            </h2>
            <p>Depending on how you use the Service, we may collect:</p>
            <ul className="list-disc space-y-2 pl-5">
              <li>
                <span className="text-white/90">Account data:</span> name,
                email address, password (hashed), organization membership, and
                role.
              </li>
              <li>
                <span className="text-white/90">Customer CRM data:</span> leads,
                contacts, companies, deals, tasks, notes, pipelines, and related
                sales activity that you or your organization upload or create.
              </li>
              <li>
                <span className="text-white/90">Communication data:</span>{" "}
                outbound and inbound message content, delivery status, and
                metadata for channels you connect (for example email and
                WhatsApp), including phone numbers and message timestamps.
              </li>
              <li>
                <span className="text-white/90">Integration credentials:</span>{" "}
                OAuth tokens and connection metadata for connected accounts
                (such as Meta WhatsApp Business and Google Gmail). Access tokens
                are encrypted at rest.
              </li>
              <li>
                <span className="text-white/90">Billing data:</span> subscription
                and payment-related information processed by our payment
                provider (for example Stripe). We do not store full card numbers
                on our servers.
              </li>
              <li>
                <span className="text-white/90">Usage and technical data:</span>{" "}
                IP address, browser type, device information, approximate
                location derived from IP, logs, and diagnostic events needed to
                operate and secure the Service.
              </li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="font-heading text-lg font-semibold text-white">
              3. How we use information
            </h2>
            <p>We use personal data to:</p>
            <ul className="list-disc space-y-2 pl-5">
              <li>Provide, maintain, and improve the Service</li>
              <li>
                Authenticate users and manage organizations, roles, and access
              </li>
              <li>
                Send and receive messages on your behalf through connected
                channels (including WhatsApp via Meta and email via Google)
              </li>
              <li>
                Process lead discovery, enrichment, scoring, sequences, and
                workflow features you enable
              </li>
              <li>Process payments and manage subscriptions</li>
              <li>
                Detect abuse, secure accounts, troubleshoot issues, and comply
                with legal obligations
              </li>
              <li>
                Communicate service-related notices (security, billing, product
                changes)
              </li>
            </ul>
            <p>
              We do not sell personal data. We do not use WhatsApp or Meta
              messaging data to build advertising profiles unrelated to
              providing the Service you requested.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="font-heading text-lg font-semibold text-white">
              4. Meta / WhatsApp Business Platform
            </h2>
            <p>
              If you connect a WhatsApp Business account through Meta Embedded
              Signup, we process data required to operate that integration,
              including:
            </p>
            <ul className="list-disc space-y-2 pl-5">
              <li>
                WhatsApp Business Account (WABA) and phone number identifiers
              </li>
              <li>Encrypted access tokens issued by Meta</li>
              <li>
                Message content and delivery statuses you send or receive
                through the Service
              </li>
              <li>
                Template and webhook event metadata needed for messaging
                reliability and auditability
              </li>
            </ul>
            <p>
              Messaging is performed using your connected business account.
              Meta processes data under Meta&apos;s own terms and policies. You
              are responsible for obtaining any required consents from message
              recipients and for complying with WhatsApp Business and Meta
              platform policies.
            </p>
            <p>
              You may disconnect WhatsApp at any time from Settings →
              Integrations. Disconnecting stops future use of that connection;
              historical message records already stored in your organization may
              remain until deleted under our retention or deletion processes.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="font-heading text-lg font-semibold text-white">
              5. How we share information
            </h2>
            <p>We may share data with:</p>
            <ul className="list-disc space-y-2 pl-5">
              <li>
                <span className="text-white/90">Service providers</span> that
                host infrastructure, databases, email/WhatsApp delivery, AI
                enrichment, analytics, or payments, under contractual
                confidentiality and security obligations
              </li>
              <li>
                <span className="text-white/90">Integration partners</span> you
                choose to connect (for example Meta and Google) to carry out the
                actions you request
              </li>
              <li>
                <span className="text-white/90">Organization members</span>{" "}
                according to roles and permissions inside your tenant
              </li>
              <li>
                <span className="text-white/90">Authorities</span> when required
                by law, legal process, or to protect rights, safety, and
                security
              </li>
            </ul>
            <p>
              If we are involved in a merger, acquisition, or asset sale,
              personal data may be transferred as part of that transaction,
              subject to continued confidentiality protections.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="font-heading text-lg font-semibold text-white">
              6. Data retention
            </h2>
            <p>
              We retain personal data for as long as needed to provide the
              Service, meet legal and accounting requirements, resolve disputes,
              and enforce agreements. Organization administrators may request
              export or deletion of eligible data through the product&apos;s
              privacy tools where available. Connected-account tokens are
              removed or invalidated when you disconnect an integration.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="font-heading text-lg font-semibold text-white">
              7. Security
            </h2>
            <p>
              We use administrative, technical, and organizational measures
              designed to protect personal data, including encryption of
              sensitive credentials at rest, access controls, and transport
              encryption (HTTPS). No method of transmission or storage is fully
              secure; we encourage strong passwords and careful management of
              organization access.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="font-heading text-lg font-semibold text-white">
              8. Your rights and choices
            </h2>
            <p>
              Depending on your location, you may have rights to access,
              correct, export, restrict, or delete personal data, and to object
              to certain processing. Organization admins can manage tenant data
              inside the Service. End users and prospects whose data is stored
              by a customer organization should typically contact that
              organization first. You may also contact us using the details
              below.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="font-heading text-lg font-semibold text-white">
              9. Children&apos;s privacy
            </h2>
            <p>
              The Service is intended for business use and is not directed to
              children under 16. We do not knowingly collect personal data from
              children. If you believe a child has provided us personal data,
              contact us and we will take appropriate steps to delete it.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="font-heading text-lg font-semibold text-white">
              10. International transfers
            </h2>
            <p>
              We may process and store data in countries other than where you
              are located. Where required, we use appropriate safeguards for
              cross-border transfers.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="font-heading text-lg font-semibold text-white">
              11. Changes to this policy
            </h2>
            <p>
              We may update this Privacy Policy from time to time. We will post
              the updated version on this page and revise the &quot;Last
              updated&quot; date. Continued use of the Service after changes
              become effective constitutes acceptance of the updated policy
              where permitted by law.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="font-heading text-lg font-semibold text-white">
              12. Contact us
            </h2>
            <p>
              For privacy questions, data requests, or concerns about this
              policy, contact us at{" "}
              <a
                href="mailto:privacy@leadsaas.app"
                className="text-emerald-400 underline-offset-2 hover:underline"
              >
                privacy@leadsaas.app
              </a>{" "}
              or through your Lead SaaS organization administrator.
            </p>
          </section>
        </div>
      </main>

      <footer className="border-t border-white/5 py-8">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 text-sm text-white/35 sm:px-6">
          <Link
            href="/"
            className="font-heading font-medium text-white/50 hover:text-white/70"
          >
            Lead SaaS
          </Link>
          <div className="flex gap-4">
            <Link href="/privacy" className="text-white/50 hover:text-white/70">
              Privacy
            </Link>
            <Link href="/login" className="hover:text-white/70">
              Sign in
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
