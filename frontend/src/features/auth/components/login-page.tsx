"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FadeIn } from "@/components/motion/fade-in";
import { authStorage } from "@/lib/auth/auth-storage";
import { useGlobalLoader } from "@/components/global-loader";
import { authApi } from "../api/auth-api";
import { loginSchema, type LoginInput } from "../schemas/auth-schema";

const DEMO_LOGIN: LoginInput = {
  email: "demo@leads.test",
  password: "Password123!",
};

export function LoginPage() {
  const queryClient = useQueryClient();
  const searchParams = useSearchParams();
  const { withLoader } = useGlobalLoader();
  const [error, setError] = useState<string | null>(null);
  const [demoLoading, setDemoLoading] = useState(false);
  const inviteAccepted = searchParams.get("invite") === "accepted";
  const form = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  useEffect(() => {
    const email = searchParams.get("email");
    if (email) form.setValue("email", email);
  }, [searchParams, form]);

  async function completeLogin(values: LoginInput) {
    setError(null);
    try {
      const result = await withLoader(
        "login",
        () => authApi.login(values),
        "Signing in…",
      );
      authStorage.setSession(result.accessToken, result.refreshToken);
      const firstOrg = result.organizations[0]?.organization.id;
      if (firstOrg) {
        authStorage.setOrganizationId(firstOrg);
      }
      await queryClient.resetQueries();
      window.location.assign("/dashboard");
    } catch {
      setError("Invalid email or password");
    }
  }

  async function onSubmit(values: LoginInput) {
    await completeLogin(values);
  }

  async function onDemoLogin() {
    setDemoLoading(true);
    form.setValue("email", DEMO_LOGIN.email);
    form.setValue("password", DEMO_LOGIN.password);
    try {
      await completeLogin(DEMO_LOGIN);
    } finally {
      setDemoLoading(false);
    }
  }

  return (
    <main className="grid min-h-full flex-1 lg:grid-cols-2">
      <div className="marketing-mesh relative hidden flex-col justify-between p-10 text-white lg:flex">
        <Link href="/" className="font-heading text-xl font-semibold">
          Lead SaaS
        </Link>
        <div className="max-w-md space-y-4">
          <h2 className="font-heading text-3xl font-semibold tracking-tight">
            From lead to customer, automatically.
          </h2>
          <p className="text-white/55">
            Capture, enrich, qualify, and reach prospects in one intelligent
            workflow.
          </p>
        </div>
        <p className="text-sm text-white/35">Trusted by modern sales teams</p>
      </div>

      <div className="bg-background flex flex-col items-center justify-center p-8">
        <FadeIn className="w-full max-w-sm space-y-6">
          <div className="space-y-1 text-center lg:text-left">
            <Link
              href="/"
              className="font-heading text-primary mb-4 inline-block text-lg font-semibold lg:hidden"
            >
              Lead SaaS
            </Link>
            <h1 className="font-heading text-2xl font-semibold tracking-tight">
              Sign in
            </h1>
            <p className="text-muted-foreground text-sm">
              Access your lead workspace
            </p>
          </div>
          {inviteAccepted ? (
            <p className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-100">
              Invite accepted. Sign in with your new password.
            </p>
          ) : null}
          <form className="space-y-4" onSubmit={form.handleSubmit(onSubmit)}>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" {...form.register("email")} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                {...form.register("password")}
              />
            </div>
            {error ? (
              <p className="text-destructive text-sm">{error}</p>
            ) : null}
            <Button
              className="w-full"
              type="submit"
              disabled={form.formState.isSubmitting || demoLoading}
            >
              {form.formState.isSubmitting ? "Signing in…" : "Sign in"}
            </Button>
            <Button
              className="w-full"
              type="button"
              variant="outline"
              disabled={form.formState.isSubmitting || demoLoading}
              onClick={() => void onDemoLogin()}
            >
              {demoLoading ? "Signing in…" : "Try demo account"}
            </Button>
            <p className="text-muted-foreground text-center text-xs">
              Demo: {DEMO_LOGIN.email}
            </p>
          </form>
          <p className="text-muted-foreground text-center text-sm lg:text-left">
            No account?{" "}
            <Link
              href="/register"
              className="text-primary underline-offset-4 hover:underline"
            >
              Create one
            </Link>
          </p>
        </FadeIn>
      </div>
    </main>
  );
}
