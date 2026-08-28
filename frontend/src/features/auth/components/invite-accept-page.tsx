"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiClient } from "@/lib/api/client";
import { authApi } from "@/features/auth/api/auth-api";
import { authStorage } from "@/lib/auth/auth-storage";

type InvitePreview = {
  email: string;
  role: string;
  organizationName: string;
  organizationId: string;
  expiresAt: string;
  needsPassword: boolean;
};

export function InviteAcceptPage() {
  const params = useParams<{ token: string }>();
  const token = params.token;
  const router = useRouter();

  const [password, setPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [error, setError] = useState<string | null>(null);

  const previewQuery = useQuery({
    queryKey: ["invite", token],
    queryFn: () =>
      apiClient<InvitePreview>(`/v1/organizations/invites/${token}`),
    enabled: Boolean(token),
    retry: false,
  });

  const completeMutation = useMutation({
    mutationFn: async () => {
      const result = await apiClient<{
        email?: string;
        organizationId?: string;
      }>(`/v1/organizations/invites/${token}/complete`, {
        method: "POST",
        body: JSON.stringify({
          password,
          firstName: firstName || undefined,
          lastName: lastName || undefined,
        }),
      });

      const email = result.email ?? previewQuery.data?.email;
      if (email) {
        try {
          const login = await authApi.login({ email, password });
          authStorage.setSession(login.accessToken, login.refreshToken);
          const orgId =
            result.organizationId ??
            login.organizations[0]?.organization.id;
          if (orgId) authStorage.setOrganizationId(orgId);
          return { loggedIn: true as const };
        } catch {
          return { loggedIn: false as const };
        }
      }
      return { loggedIn: false as const };
    },
    onSuccess: (data) => {
      if (data.loggedIn) {
        router.replace("/dashboard");
        return;
      }
      router.replace(
        `/login?invite=accepted&email=${encodeURIComponent(previewQuery.data?.email ?? "")}`,
      );
    },
    onError: (err: Error) => setError(err.message),
  });

  if (previewQuery.isLoading) {
    return (
      <main className="mx-auto flex min-h-full max-w-md flex-col justify-center gap-4 p-6">
        <p className="text-muted-foreground text-sm">Loading invite…</p>
      </main>
    );
  }

  if (previewQuery.isError || !previewQuery.data) {
    return (
      <main className="mx-auto flex min-h-full max-w-md flex-col justify-center gap-4 p-6">
        <h1 className="text-xl font-semibold">Invite unavailable</h1>
        <p className="text-muted-foreground text-sm">
          {(previewQuery.error as Error)?.message ||
            "This invite link is invalid or expired."}
        </p>
        <Link href="/login" className="text-sm underline">
          Go to login
        </Link>
      </main>
    );
  }

  const invite = previewQuery.data;

  return (
    <main className="mx-auto flex min-h-full max-w-md flex-col justify-center gap-6 p-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">
          Join {invite.organizationName}
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Invited as <span className="capitalize">{invite.role}</span> ·{" "}
          {invite.email}
        </p>
      </div>

      {error ? <p className="text-destructive text-sm">{error}</p> : null}

      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          completeMutation.mutate();
        }}
      >
        <div className="space-y-2">
          <Label htmlFor="invite-first">First name</Label>
          <Input
            id="invite-first"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="invite-last">Last name</Label>
          <Input
            id="invite-last"
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="invite-password">Password</Label>
          <Input
            id="invite-password"
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={8}
          />
        </div>
        <Button
          type="submit"
          className="w-full"
          disabled={password.length < 8 || completeMutation.isPending}
        >
          Accept invite
        </Button>
      </form>

      <p className="text-muted-foreground text-center text-xs">
        Already have an account?{" "}
        <Link href="/login" className="underline">
          Sign in
        </Link>
      </p>
    </main>
  );
}
