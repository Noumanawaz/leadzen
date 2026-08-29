"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  History,
  Mail,
  MessageCircle,
  MessageSquare,
  Phone,
  Sparkles,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { apiClient } from "@/lib/api/client";
import { toE164 } from "../utils/phone";

export type LeadContactTarget = {
  id: string;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  phone: string | null;
  company?: { name: string } | null;
};

type ConnectedAccount = {
  id: string;
  provider: string;
  label: string;
  status: string;
};

type LeadMessage = {
  id: string;
  channel: string;
  direction: string;
  status: string;
  subject: string | null;
  body: string | null;
  toAddress: string | null;
  fromAddress: string | null;
  error: string | null;
  createdAt: string;
};

type AiEmailResult = {
  text: string;
  model: string;
  creditsUsed: number;
};

function leadLabel(lead: LeadContactTarget) {
  return (
    [lead.firstName, lead.lastName].filter(Boolean).join(" ") ||
    lead.email ||
    lead.company?.name ||
    lead.phone ||
    "Untitled lead"
  );
}

function channelLabel(channel: string) {
  switch (channel) {
    case "email":
      return "Email";
    case "whatsapp":
      return "WhatsApp";
    case "sms":
      return "SMS";
    case "phone":
      return "Call";
    default:
      return channel;
  }
}

function parseEmailDraft(text: string): { subject: string; body: string } {
  const trimmed = text.trim();
  const jsonMatch = trimmed.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[0]) as {
        subject?: string;
        body?: string;
      };
      if (parsed.subject || parsed.body) {
        return {
          subject: parsed.subject?.trim() || "Follow-up",
          body: parsed.body?.trim() || trimmed,
        };
      }
    } catch {
      // fall through
    }
  }

  const withoutStub = trimmed.replace(/^\[stub:[^\]]+\]\s*/i, "");
  return { subject: "Follow-up", body: withoutStub };
}

export function LeadContactSheet({
  lead,
  open,
  onOpenChange,
}: {
  lead: LeadContactTarget | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const [tab, setTab] = useState("email");
  const [message, setMessage] = useState<string | null>(null);

  const [aiPrompt, setAiPrompt] = useState("");
  const [emailSubject, setEmailSubject] = useState("");
  const [emailBody, setEmailBody] = useState("");
  const [whatsappBody, setWhatsappBody] = useState("");
  const [smsBody, setSmsBody] = useState("");

  const phoneE164 = useMemo(
    () => (lead ? toE164(lead.phone) : null),
    [lead],
  );

  useEffect(() => {
    if (!open) return;
    setMessage(null);
    setAiPrompt("");
    setTab(lead?.email ? "email" : lead?.phone ? "whatsapp" : "email");
  }, [open, lead?.id, lead?.email, lead?.phone]);

  const accountsQuery = useQuery({
    queryKey: ["send-accounts"],
    queryFn: () => apiClient<ConnectedAccount[]>("/v1/integrations/send-accounts"),
    enabled: open,
  });

  const whatsappStatusQuery = useQuery({
    queryKey: ["whatsapp-status"],
    queryFn: () =>
      apiClient<{
        connected: boolean;
        configured: boolean;
        status: string;
        phoneNumber?: string;
        displayName?: string;
        connectedAccount: { id: string; label: string } | null;
      }>("/v1/integrations/whatsapp/status"),
    enabled: open,
  });

  const whatsappStatus = whatsappStatusQuery.data?.status ?? "disconnected";
  const whatsappConnected =
    Boolean(whatsappStatusQuery.data?.connected) &&
    whatsappStatus === "connected";
  const whatsappNeedsAttention =
    whatsappStatus === "error" || whatsappStatus === "requires_reconnect";

  const gmailAccount = useMemo(
    () =>
      (accountsQuery.data ?? []).find(
        (a) => a.provider === "gmail" && a.status === "active",
      ),
    [accountsQuery.data],
  );

  const messagesQuery = useQuery({
    queryKey: ["lead-messages", lead?.id],
    queryFn: () =>
      apiClient<LeadMessage[]>(
        `/v1/integrations/messages?leadId=${encodeURIComponent(lead!.id)}`,
      ),
    enabled: open && Boolean(lead?.id),
  });

  const invalidateAfterSend = () => {
    void queryClient.invalidateQueries({ queryKey: ["lead-messages", lead?.id] });
    void queryClient.invalidateQueries({ queryKey: ["leads"] });
    void queryClient.invalidateQueries({ queryKey: ["credits"] });
  };

  const aiEmailMutation = useMutation({
    mutationFn: () =>
      apiClient<AiEmailResult>("/v1/ai/generate-email", {
        method: "POST",
        body: JSON.stringify({
          leadId: lead!.id,
          goal: aiPrompt.trim(),
        }),
      }),
    onSuccess: (data) => {
      const draft = parseEmailDraft(data.text);
      setEmailSubject(draft.subject);
      setEmailBody(draft.body);
      const stub = data.text.startsWith("[stub:");
      setMessage(
        stub
          ? "Email draft filled in (AI stub mode — add GROQ_API_KEY for real drafts)."
          : "Email draft filled in. Review and send when ready.",
      );
      void queryClient.invalidateQueries({ queryKey: ["credits"] });
    },
    onError: (err: Error) => setMessage(err.message),
  });

  const emailMutation = useMutation({
    mutationFn: () =>
      apiClient("/v1/integrations/email/send", {
        method: "POST",
        body: JSON.stringify({
          connectedAccountId: gmailAccount!.id,
          to: lead!.email,
          subject: emailSubject,
          body: emailBody,
          leadId: lead!.id,
        }),
      }),
    onSuccess: () => {
      setMessage("Email sent via Gmail.");
      setEmailSubject("");
      setEmailBody("");
      setAiPrompt("");
      invalidateAfterSend();
    },
    onError: (err: Error) => setMessage(err.message),
  });

  const whatsappMutation = useMutation({
    mutationFn: () =>
      apiClient("/v1/integrations/whatsapp/send", {
        method: "POST",
        body: JSON.stringify({
          toE164: phoneE164,
          body: whatsappBody,
          leadId: lead!.id,
        }),
      }),
    onSuccess: () => {
      setMessage("WhatsApp message sent.");
      setWhatsappBody("");
      invalidateAfterSend();
    },
    onError: (err: Error) => setMessage(err.message),
  });

  const smsMutation = useMutation({
    mutationFn: () =>
      apiClient<{ simulated?: boolean }>("/v1/integrations/sms/send", {
        method: "POST",
        body: JSON.stringify({
          toE164: phoneE164,
          body: smsBody,
          leadId: lead!.id,
        }),
      }),
    onSuccess: (data) => {
      setMessage(
        data.simulated !== false
          ? "SMS sent (simulated / placeholder)."
          : "SMS sent.",
      );
      setSmsBody("");
      invalidateAfterSend();
    },
    onError: (err: Error) => setMessage(err.message),
  });

  const callMutation = useMutation({
    mutationFn: () =>
      apiClient<{ status: string; simulatedMinutes?: number; simulated?: boolean }>(
        "/v1/integrations/phone/call",
        {
          method: "POST",
          body: JSON.stringify({
            toE164: phoneE164,
            leadId: lead!.id,
          }),
        },
      ),
    onSuccess: (data) => {
      const base = `Call ${data.status.replace("_", " ")}`;
      setMessage(
        data.simulated
          ? `${base} (simulated).`
          : base + ".",
      );
      invalidateAfterSend();
    },
    onError: (err: Error) => setMessage(err.message),
  });

  if (!lead) return null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="flex h-full w-full max-w-none flex-col gap-0 overflow-hidden p-0 sm:max-w-none sm:w-[min(100vw,56rem)]"
      >
        <SheetHeader className="border-border shrink-0 border-b px-6 py-5 pr-14">
          <SheetTitle className="text-lg">{leadLabel(lead)}</SheetTitle>
          <SheetDescription className="text-sm">
            {[lead.email, lead.phone, lead.company?.name]
              .filter(Boolean)
              .join(" · ")}
          </SheetDescription>
        </SheetHeader>

        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
          {message ? (
            <p className="bg-muted/50 border-border mx-6 mt-4 shrink-0 rounded-md border px-3 py-2 text-sm">
              {message}
            </p>
          ) : null}

          <Tabs
            value={tab}
            onValueChange={setTab}
            className="flex min-h-0 flex-1 flex-col px-6 pt-4 pb-8"
          >
            <TabsList
              variant="line"
              className="border-border h-auto w-full shrink-0 justify-start gap-0 overflow-x-auto border-b bg-transparent p-0"
            >
              <TabsTrigger
                value="email"
                disabled={!lead.email}
                className="rounded-none px-4 py-2.5"
              >
                <Mail className="size-4" />
                Email
              </TabsTrigger>
              <TabsTrigger
                value="whatsapp"
                disabled={!phoneE164}
                className="rounded-none px-4 py-2.5"
              >
                <MessageCircle className="size-4" />
                WhatsApp
              </TabsTrigger>
              <TabsTrigger
                value="sms"
                disabled={!phoneE164}
                className="rounded-none px-4 py-2.5"
              >
                <MessageSquare className="size-4" />
                SMS
              </TabsTrigger>
              <TabsTrigger
                value="call"
                disabled={!phoneE164}
                className="rounded-none px-4 py-2.5"
              >
                <Phone className="size-4" />
                Call
              </TabsTrigger>
              <TabsTrigger value="history" className="rounded-none px-4 py-2.5">
                <History className="size-4" />
                History
              </TabsTrigger>
            </TabsList>

            <TabsContent value="email" className="mt-6 space-y-5">
              <div className="border-border bg-muted/20 space-y-3 rounded-lg border p-4">
                <Label htmlFor="ai-prompt" className="text-sm font-medium">
                  Write with AI
                </Label>
                <Textarea
                  id="ai-prompt"
                  rows={4}
                  value={aiPrompt}
                  onChange={(e) => setAiPrompt(e.target.value)}
                  placeholder="Describe the email you want… e.g. Follow up after our demo and suggest a call next Tuesday"
                  className="min-h-24 resize-y bg-background"
                />
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => aiEmailMutation.mutate()}
                  disabled={!aiPrompt.trim() || aiEmailMutation.isPending}
                >
                  <Sparkles className="size-4" />
                  {aiEmailMutation.isPending ? "Generating…" : "Generate email"}
                </Button>
              </div>

              {gmailAccount ? (
                <p className="text-muted-foreground text-xs">
                  Sending from{" "}
                  <span className="text-foreground font-medium">
                    {gmailAccount.label}
                  </span>
                </p>
              ) : (
                <p className="text-muted-foreground text-sm">
                  Connect Gmail under{" "}
                  <Link href="/settings/integrations" className="underline">
                    Integrations
                  </Link>{" "}
                  to send. You can still draft with AI below.
                </p>
              )}

              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email-to">To</Label>
                  <Input
                    id="email-to"
                    value={lead.email ?? ""}
                    readOnly
                    className="bg-muted/30"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email-subject">Subject</Label>
                  <Input
                    id="email-subject"
                    value={emailSubject}
                    onChange={(e) => setEmailSubject(e.target.value)}
                    placeholder="Quick follow-up"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email-body">Message</Label>
                  <Textarea
                    id="email-body"
                    rows={10}
                    value={emailBody}
                    onChange={(e) => setEmailBody(e.target.value)}
                    placeholder="Hi, following up on our conversation…"
                    className="min-h-48 resize-y"
                  />
                </div>
              </div>

              <Button
                onClick={() => emailMutation.mutate()}
                disabled={
                  !gmailAccount ||
                  !emailSubject.trim() ||
                  !emailBody.trim() ||
                  emailMutation.isPending
                }
              >
                {emailMutation.isPending ? "Sending…" : "Send email"}
              </Button>
            </TabsContent>

            <TabsContent value="whatsapp" className="mt-6 space-y-4">
              {whatsappNeedsAttention ? (
                <p className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-100">
                  WhatsApp connection requires attention.{" "}
                  <Link href="/settings/integrations" className="underline">
                    Reconnect WhatsApp
                  </Link>{" "}
                  in Integrations before messaging this lead.
                </p>
              ) : null}
              {!whatsappConnected && !whatsappNeedsAttention ? (
                <p className="text-muted-foreground text-sm">
                  WhatsApp is not connected.{" "}
                  <Link href="/settings/integrations" className="underline">
                    Connect WhatsApp
                  </Link>{" "}
                  in Integrations before messaging this lead.
                </p>
              ) : null}
              {whatsappConnected ? (
                <p className="text-muted-foreground text-xs">
                  To {phoneE164}
                  {whatsappStatusQuery.data?.displayName
                    ? ` · ${whatsappStatusQuery.data.displayName}`
                    : ""}
                  . Uses your workspace WhatsApp Business account (1 credit per
                  message).
                </p>
              ) : null}
              <div className="space-y-2">
                <Label htmlFor="wa-body">Message</Label>
                <Textarea
                  id="wa-body"
                  rows={5}
                  value={whatsappBody}
                  onChange={(e) => setWhatsappBody(e.target.value)}
                  placeholder="Hello, this is…"
                  disabled={!whatsappConnected}
                />
              </div>
              <Button
                onClick={() => whatsappMutation.mutate()}
                disabled={
                  !whatsappConnected ||
                  !whatsappBody.trim() ||
                  whatsappMutation.isPending
                }
              >
                Send WhatsApp
              </Button>
            </TabsContent>

            <TabsContent value="sms" className="mt-6 space-y-4">
              <span className="inline-flex rounded-md border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-xs text-amber-200">
                Placeholder
              </span>
              <p className="text-muted-foreground text-xs">
                To {phoneE164}. SMS uses a placeholder provider until Twilio is
                wired (1 credit per message).
              </p>
              <div className="space-y-2">
                <Label htmlFor="sms-body">Message</Label>
                <Textarea
                  id="sms-body"
                  rows={4}
                  value={smsBody}
                  onChange={(e) => setSmsBody(e.target.value)}
                />
              </div>
              <Button
                onClick={() => smsMutation.mutate()}
                disabled={!smsBody.trim() || smsMutation.isPending}
              >
                Send SMS
              </Button>
            </TabsContent>

            <TabsContent value="call" className="mt-6 space-y-4">
              <span className="inline-flex rounded-md border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-xs text-amber-200">
                Placeholder
              </span>
              <p className="text-muted-foreground text-sm">
                Place an outbound call to {phoneE164}. Phone uses a simulated
                provider until Twilio Voice is connected.
              </p>
              <Button
                onClick={() => callMutation.mutate()}
                disabled={callMutation.isPending}
              >
                Start call
              </Button>
            </TabsContent>

            <TabsContent value="history" className="mt-6 space-y-3">
              {messagesQuery.isLoading ? (
                <p className="text-muted-foreground text-sm">Loading…</p>
              ) : !(messagesQuery.data ?? []).length ? (
                <p className="text-muted-foreground text-sm">
                  No messages logged for this lead yet.
                </p>
              ) : (
                <ul className="space-y-3">
                  {(messagesQuery.data ?? []).map((item) => (
                    <li
                      key={item.id}
                      className="border-border rounded-md border p-3 text-sm"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium capitalize">
                          {channelLabel(item.channel)} · {item.direction}
                        </span>
                        <span className="text-muted-foreground text-xs capitalize">
                          {item.status.replace("_", " ")}
                        </span>
                      </div>
                      {item.subject ? (
                        <p className="mt-1 font-medium">{item.subject}</p>
                      ) : null}
                      {item.body ? (
                        <p className="text-muted-foreground mt-1 whitespace-pre-wrap">
                          {item.body}
                        </p>
                      ) : null}
                      <p className="text-muted-foreground mt-2 text-xs">
                        {new Date(item.createdAt).toLocaleString()}
                        {item.toAddress ? ` → ${item.toAddress}` : ""}
                      </p>
                      {item.error ? (
                        <p className="text-destructive mt-1 text-xs">
                          {item.error}
                        </p>
                      ) : null}
                    </li>
                  ))}
                </ul>
              )}
            </TabsContent>
          </Tabs>
        </div>
      </SheetContent>
    </Sheet>
  );
}
