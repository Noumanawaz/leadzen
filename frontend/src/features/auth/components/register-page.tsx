"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FadeIn } from "@/components/motion/fade-in";
import { authStorage } from "@/lib/auth/auth-storage";
import { useGlobalLoader } from "@/components/global-loader";
import { authApi } from "../api/auth-api";
import { registerSchema, type RegisterInput } from "../schemas/auth-schema";

export function RegisterPage() {
  const queryClient = useQueryClient();
  const { withLoader } = useGlobalLoader();
  const [error, setError] = useState<string | null>(null);
  const form = useForm<RegisterInput>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      email: "",
      password: "",
      firstName: "",
      lastName: "",
      organizationName: "",
    },
  });

  async function onSubmit(values: RegisterInput) {
    setError(null);
    try {
      const result = await withLoader(
        "register",
        () => authApi.register(values),
        "Creating account…",
      );
      authStorage.setSession(result.accessToken, result.refreshToken);
      authStorage.setOrganizationId(result.organization.id);
      await queryClient.resetQueries();
      window.location.assign("/dashboard");
    } catch {
      setError("Could not create account. Email may already be in use.");
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
            Start your intelligent sales workflow.
          </h2>
          <p className="text-white/55">
            Spin up a workspace, invite your team, and turn every lead into an
            opportunity.
          </p>
        </div>
        <p className="text-sm text-white/35">No credit card required</p>
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
              Create account
            </h1>
            <p className="text-muted-foreground text-sm">
              Start a trial workspace for your team
            </p>
          </div>
          <form className="space-y-4" onSubmit={form.handleSubmit(onSubmit)}>
            <div className="space-y-2">
              <Label htmlFor="organizationName">Organization</Label>
              <Input
                id="organizationName"
                {...form.register("organizationName")}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="firstName">First name</Label>
                <Input id="firstName" {...form.register("firstName")} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lastName">Last name</Label>
                <Input id="lastName" {...form.register("lastName")} />
              </div>
            </div>
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
              disabled={form.formState.isSubmitting}
            >
              {form.formState.isSubmitting ? "Creating…" : "Create account"}
            </Button>
          </form>
          <p className="text-muted-foreground text-center text-sm lg:text-left">
            Already have an account?{" "}
            <Link
              href="/login"
              className="text-primary underline-offset-4 hover:underline"
            >
              Sign in
            </Link>
          </p>
        </FadeIn>
      </div>
    </main>
  );
}
