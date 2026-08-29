"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiClient } from "@/lib/api/client";

type Props = {
  onSuccess?: () => void;
  onError?: (message: string) => void;
};

export function WhatsAppManualConnectForm({ onSuccess, onError }: Props) {
  const queryClient = useQueryClient();
  const [accessToken, setAccessToken] = useState("");
  const [phoneNumberId, setPhoneNumberId] = useState("");
  const [wabaId, setWabaId] = useState("");

  const connectMutation = useMutation({
    mutationFn: () =>
      apiClient("/v1/integrations/whatsapp/connect/manual", {
        method: "POST",
        body: JSON.stringify({
          accessToken: accessToken.trim(),
          phoneNumberId: phoneNumberId.trim(),
          wabaId: wabaId.trim() || undefined,
        }),
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["connected-accounts"] });
      void queryClient.invalidateQueries({ queryKey: ["whatsapp-integration"] });
      void queryClient.invalidateQueries({ queryKey: ["whatsapp-status"] });
      onSuccess?.();
    },
    onError: (err: Error) => onError?.(err.message),
  });

  return (
    <form
      className="space-y-3 rounded-md border border-dashed border-amber-500/40 bg-amber-500/5 p-4"
      onSubmit={(e) => {
        e.preventDefault();
        connectMutation.mutate();
      }}
    >
      <p className="text-sm font-medium text-amber-100">Development manual connect</p>
      <p className="text-muted-foreground text-xs">
        Use this only when Meta Embedded Signup is not configured locally. Paste
        credentials from the Meta developer dashboard or{" "}
        <code className="text-xs">scripts/seed-whatsapp-account.ts</code>.
      </p>
      <div className="space-y-1">
        <Label htmlFor="wa-access-token">Access token</Label>
        <Input
          id="wa-access-token"
          type="password"
          autoComplete="off"
          value={accessToken}
          onChange={(e) => setAccessToken(e.target.value)}
          placeholder="EAA…"
          required
        />
      </div>
      <div className="space-y-1">
        <Label htmlFor="wa-phone-id">Phone Number ID</Label>
        <Input
          id="wa-phone-id"
          value={phoneNumberId}
          onChange={(e) => setPhoneNumberId(e.target.value)}
          placeholder="123456789012345"
          required
        />
      </div>
      <div className="space-y-1">
        <Label htmlFor="wa-waba-id">WABA ID (optional)</Label>
        <Input
          id="wa-waba-id"
          value={wabaId}
          onChange={(e) => setWabaId(e.target.value)}
          placeholder="987654321098765"
        />
      </div>
      <Button
        type="submit"
        disabled={
          connectMutation.isPending ||
          !accessToken.trim() ||
          !phoneNumberId.trim()
        }
      >
        {connectMutation.isPending ? "Connecting…" : "Connect manually (dev)"}
      </Button>
    </form>
  );
}
