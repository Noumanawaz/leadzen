"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { apiClient } from "@/lib/api/client";

type WhatsAppPlatformSetup = {
  embeddedSignupConfigured: boolean;
  messagingConfigured: boolean;
  tokenEncryptionConfigured: boolean;
  missingEnvVars: string[];
  webhookPath: string;
  setupSteps: string[];
  appId?: string;
  graphApiVersion: string;
  devManualConnectAvailable: boolean;
};

export function WhatsAppPlatformSetup() {
  const setupQuery = useQuery({
    queryKey: ["admin-integrations-settings"],
    queryFn: () =>
      apiClient<{ whatsapp: WhatsAppPlatformSetup }>(
        "/admin/settings/integrations",
      ),
  });

  const wa = setupQuery.data?.whatsapp;
  if (!wa) {
    return (
      <p className="text-muted-foreground text-sm">Loading WhatsApp setup…</p>
    );
  }

  const webhookUrl =
    typeof window !== "undefined"
      ? `${window.location.protocol}//${window.location.hostname === "localhost" ? "localhost:4000" : window.location.host.replace(/^[^.]+\./, "api.")}${wa.webhookPath}`
      : wa.webhookPath;

  return (
    <section className="border-border space-y-4 rounded-lg border p-4">
      <div>
        <h2 className="font-medium">WhatsApp (Meta Embedded Signup)</h2>
        <p className="text-muted-foreground mt-1 text-sm">
          Platform-wide Meta app credentials. Tenants connect their own numbers
          via Embedded Signup once this is configured.
        </p>
      </div>

      <div className="grid gap-2 text-sm sm:grid-cols-2">
        <StatusRow
          label="Embedded Signup"
          ok={wa.embeddedSignupConfigured}
        />
        <StatusRow label="Meta app (send)" ok={wa.messagingConfigured} />
        <StatusRow
          label="Token encryption"
          ok={wa.tokenEncryptionConfigured}
        />
        {wa.appId ? (
          <div>
            <span className="text-muted-foreground">App ID: </span>
            <span className="font-mono text-xs">{wa.appId}</span>
          </div>
        ) : null}
      </div>

      {wa.missingEnvVars.length > 0 ? (
        <div className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-3 text-sm">
          <p className="font-medium text-amber-100">Missing backend env vars</p>
          <ul className="mt-2 list-inside list-disc text-xs">
            {wa.missingEnvVars.map((key) => (
              <li key={key}>
                <code>{key}</code>
              </li>
            ))}
          </ul>
          <p className="text-muted-foreground mt-2 text-xs">
            Add these to <code>backend/.env</code> (local) or your hosting
            provider (production), then restart the API.
          </p>
        </div>
      ) : (
        <p className="text-sm text-green-400">
          WhatsApp Embedded Signup is fully configured.
        </p>
      )}

      <div className="space-y-2 text-sm">
        <p className="font-medium">Setup checklist</p>
        <ol className="text-muted-foreground list-inside list-decimal space-y-1 text-xs">
          {wa.setupSteps.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
      </div>

      <div className="space-y-1 text-sm">
        <p className="font-medium">Webhook callback URL</p>
        <code className="block overflow-x-auto rounded bg-black/30 px-2 py-1 text-xs">
          {webhookUrl}
        </code>
        <p className="text-muted-foreground text-xs">
          Register in Meta → WhatsApp → Configuration. Subscribe to{" "}
          <strong>messages</strong>. Graph API: {wa.graphApiVersion}
        </p>
      </div>

      {wa.devManualConnectAvailable ? (
        <p className="text-muted-foreground text-xs">
          Dev fallback: tenants can use manual connect on{" "}
          <Link href="/settings/integrations" className="underline">
            Integrations
          </Link>{" "}
          until Embedded Signup is configured.
        </p>
      ) : null}

      <p className="text-muted-foreground text-xs">
        See{" "}
        <a
          href="https://developers.facebook.com/docs/whatsapp/embedded-signup"
          target="_blank"
          rel="noreferrer"
          className="underline"
        >
          Meta Embedded Signup docs
        </a>
        .
      </p>
    </section>
  );
}

function StatusRow({ label, ok }: { label: string; ok: boolean }) {
  return (
    <div>
      <span className="text-muted-foreground">{label}: </span>
      <span className={ok ? "text-green-400" : "text-amber-300"}>
        {ok ? "ready" : "not configured"}
      </span>
    </div>
  );
}
