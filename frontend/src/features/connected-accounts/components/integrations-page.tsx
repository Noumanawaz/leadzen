"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { apiClient } from "@/lib/api/client";
import { useWhatsAppEmbeddedSignup } from "../hooks/use-whatsapp-embedded-signup";

type ConnectedAccount = {
  id: string;
  provider: string;
  label: string;
  status: string;
  externalAccountId: string | null;
};

type WhatsAppIntegration = {
  connected: boolean;
  status: string;
  phoneNumber?: string;
  displayName?: string;
  lastVerifiedAt?: string;
};

export function IntegrationsPage() {
  const queryClient = useQueryClient();
  const search =
    typeof window !== "undefined" ? window.location.search : "";
  const [waMessage, setWaMessage] = useState<string | null>(null);
  const whatsappSignup = useWhatsAppEmbeddedSignup();

  const statusQuery = useQuery({
    queryKey: ["gmail-status"],
    queryFn: () => apiClient<{ configured: boolean }>("/v1/integrations/gmail/status"),
  });

  const accountsQuery = useQuery({
    queryKey: ["connected-accounts"],
    queryFn: () => apiClient<ConnectedAccount[]>("/v1/integrations/accounts"),
  });

  const whatsAppQuery = useQuery({
    queryKey: ["whatsapp-integration"],
    queryFn: () =>
      apiClient<WhatsAppIntegration>("/v1/integrations/whatsapp"),
  });

  const whatsAppConfigQuery = useQuery({
    queryKey: ["whatsapp-config"],
    queryFn: () =>
      apiClient<{
        configured: boolean;
        messagingConfigured: boolean;
        embeddedSignupConfigured: boolean;
      }>("/v1/integrations/whatsapp/config"),
  });

  const connectMutation = useMutation({
    mutationFn: () =>
      apiClient<{ url: string }>("/v1/integrations/gmail/connect"),
    onSuccess: (data) => {
      window.location.href = data.url;
    },
  });

  const disconnectMutation = useMutation({
    mutationFn: (id: string) =>
      apiClient(`/v1/integrations/accounts/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["connected-accounts"] });
      void queryClient.invalidateQueries({ queryKey: ["whatsapp-integration"] });
      void queryClient.invalidateQueries({ queryKey: ["whatsapp-status"] });
    },
  });

  const whatsAppDisconnectMutation = useMutation({
    mutationFn: () =>
      apiClient("/v1/integrations/whatsapp/disconnect", { method: "POST" }),
    onSuccess: () => {
      setWaMessage("WhatsApp disconnected.");
      void queryClient.invalidateQueries({ queryKey: ["connected-accounts"] });
      void queryClient.invalidateQueries({ queryKey: ["whatsapp-integration"] });
      void queryClient.invalidateQueries({ queryKey: ["whatsapp-status"] });
    },
    onError: (err: Error) => setWaMessage(err.message),
  });

  const whatsAppTestMutation = useMutation({
    mutationFn: () =>
      apiClient<{ ok: boolean; phoneNumber?: string }>(
        "/v1/integrations/whatsapp/test",
        { method: "POST" },
      ),
    onSuccess: (data) => {
      setWaMessage(
        data.phoneNumber
          ? `Connection OK for ${data.phoneNumber}.`
          : "Connection OK.",
      );
      void queryClient.invalidateQueries({ queryKey: ["whatsapp-integration"] });
      void queryClient.invalidateQueries({ queryKey: ["whatsapp-status"] });
    },
    onError: (err: Error) => setWaMessage(err.message),
  });

  const whatsAppConnectMutation = useMutation({
    mutationFn: () => whatsappSignup.connect(),
    onSuccess: () => {
      setWaMessage("WhatsApp Business connected.");
      void queryClient.invalidateQueries({ queryKey: ["connected-accounts"] });
      void queryClient.invalidateQueries({ queryKey: ["whatsapp-integration"] });
      void queryClient.invalidateQueries({ queryKey: ["whatsapp-status"] });
    },
    onError: (err: Error) => setWaMessage(err.message),
  });

  const accounts = accountsQuery.data ?? [];
  const hasActiveGmail = accounts.some(
    (a) => a.provider === "gmail" && a.status === "active",
  );
  const whatsapp = whatsAppQuery.data;
  const whatsappStatus = whatsapp?.status ?? "disconnected";
  const whatsappConnected =
    Boolean(whatsapp?.connected) && whatsappStatus === "connected";
  const whatsappNeedsAttention =
    whatsappStatus === "error" || whatsappStatus === "requires_reconnect";
  const embeddedSignupReady = Boolean(
    whatsAppConfigQuery.data?.embeddedSignupConfigured,
  );
  const connectPending =
    whatsAppConnectMutation.isPending || whatsappSignup.loading;

  function handleConnectWhatsApp() {
    setWaMessage(null);
    whatsAppConnectMutation.mutate();
  }

  return (
    <main className="flex flex-1 flex-col gap-6 p-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Integrations</h1>
        <p className="text-muted-foreground text-sm">
          Connect Gmail and WhatsApp so sales agents can email and message leads
          from the Leads page.
        </p>
      </div>

      {search.includes("gmail=connected") ? (
        <p className="text-sm text-green-700">Gmail connected successfully.</p>
      ) : null}
      {search.includes("gmail=error") ? (
        <p className="text-destructive text-sm">Gmail connection failed.</p>
      ) : null}

      <section className="border-border space-y-3 rounded-lg border p-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="font-medium">Gmail</h2>
            <p className="text-muted-foreground text-xs">
              OAuth configured:{" "}
              {statusQuery.data?.configured
                ? "yes"
                : "no — add Google credentials to backend .env"}
              {hasActiveGmail
                ? " · already connected for this workspace"
                : ""}
            </p>
          </div>
          <Button
            onClick={() => connectMutation.mutate()}
            disabled={
              !statusQuery.data?.configured ||
              hasActiveGmail ||
              connectMutation.isPending
            }
          >
            {hasActiveGmail ? "Gmail connected" : "Connect Gmail"}
          </Button>
        </div>
      </section>

      <section className="border-border space-y-4 rounded-lg border p-4">
        <div>
          <h2 className="font-medium">WhatsApp</h2>
          <p className="text-muted-foreground mt-1 text-sm">
            Connect your business WhatsApp number to start messaging your
            customers.
          </p>
        </div>

        {waMessage || whatsappSignup.error ? (
          <p className="text-sm">{waMessage ?? whatsappSignup.error}</p>
        ) : null}

        {whatsappConnected ? (
          <div className="space-y-3">
            <div className="rounded-md border border-green-500/30 bg-green-500/10 px-3 py-3 text-sm">
              <p className="font-medium text-green-100">Connected</p>
              <p className="mt-1">
                Business: {whatsapp?.displayName ?? "WhatsApp Business"}
              </p>
              {whatsapp?.phoneNumber ? (
                <p className="text-muted-foreground">
                  Phone: {whatsapp.phoneNumber}
                </p>
              ) : null}
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="secondary"
                onClick={() => whatsAppTestMutation.mutate()}
                disabled={whatsAppTestMutation.isPending}
              >
                Test Connection
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  if (
                    window.confirm(
                      "Disconnect WhatsApp for this workspace?",
                    )
                  ) {
                    whatsAppDisconnectMutation.mutate();
                  }
                }}
                disabled={whatsAppDisconnectMutation.isPending}
              >
                Disconnect
              </Button>
            </div>
          </div>
        ) : whatsappNeedsAttention ? (
          <div className="space-y-3">
            <div className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-3 text-sm">
              <p className="font-medium text-amber-100">
                Connection requires attention
              </p>
              <p className="text-muted-foreground mt-1">
                Your WhatsApp connection is no longer active. Reconnect through
                Meta to resume messaging.
              </p>
              {whatsapp?.phoneNumber ? (
                <p className="text-muted-foreground mt-1 text-xs">
                  Last known: {whatsapp.displayName ?? "WhatsApp"} ·{" "}
                  {whatsapp.phoneNumber}
                </p>
              ) : null}
            </div>
            <Button onClick={handleConnectWhatsApp} disabled={connectPending}>
              {connectPending ? "Connecting…" : "Reconnect WhatsApp"}
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            {!embeddedSignupReady ? (
              <p className="text-muted-foreground text-sm">
                WhatsApp onboarding is not configured on this server. Contact
                your administrator to enable Meta Embedded Signup.
              </p>
            ) : (
              <Button onClick={handleConnectWhatsApp} disabled={connectPending}>
                {connectPending ? "Connecting…" : "Connect WhatsApp"}
              </Button>
            )}
          </div>
        )}

        <p className="text-muted-foreground text-xs">
          Each WhatsApp message debits 1 platform credit.
        </p>
      </section>

      <section className="border-border space-y-2 rounded-lg border p-4">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="font-medium">SMS</h2>
          <span className="inline-flex rounded-md border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-xs text-amber-200">
            Placeholder
          </span>
        </div>
        <p className="text-muted-foreground text-xs">
          Outbound SMS is simulated until a Twilio (or similar) provider is
          wired.
        </p>
      </section>

      <section className="border-border space-y-2 rounded-lg border p-4">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="font-medium">Phone calls</h2>
          <span className="inline-flex rounded-md border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-xs text-amber-200">
            Placeholder / simulated
          </span>
        </div>
        <p className="text-muted-foreground text-xs">
          Outbound calling is simulated until Twilio Voice is connected.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-medium">Connected accounts</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-muted-foreground border-b">
              <tr>
                <th className="py-2 pr-4 font-medium">Provider</th>
                <th className="py-2 pr-4 font-medium">Label</th>
                <th className="py-2 pr-4 font-medium">Status</th>
                <th className="py-2 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {(accountsQuery.data ?? []).map((row) => (
                <tr key={row.id} className="border-b border-border/60">
                  <td className="py-2 pr-4 capitalize">
                    {row.provider.replace("_", " ")}
                  </td>
                  <td className="py-2 pr-4">{row.label}</td>
                  <td className="py-2 pr-4 capitalize">{row.status}</td>
                  <td className="py-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => disconnectMutation.mutate(row.id)}
                    >
                      Disconnect
                    </Button>
                  </td>
                </tr>
              ))}
              {!accountsQuery.data?.length ? (
                <tr>
                  <td colSpan={4} className="text-muted-foreground py-6">
                    No connected accounts yet
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
