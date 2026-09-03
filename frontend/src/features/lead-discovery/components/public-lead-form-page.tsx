"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import { useParams } from "next/navigation";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  inputTypeForField,
  parseLeadFormPresentation,
} from "../lib/lead-form-fields";

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api";

type PublicForm = {
  publicId: string;
  name: string;
  fields?: unknown;
  description?: string;
  submitLabel?: string;
  honeypot?: boolean;
};

export function PublicLeadFormPage() {
  const params = useParams<{ publicId: string }>();
  const publicId = params.publicId;
  const [values, setValues] = useState<Record<string, string>>({});
  const [honeypotValue, setHoneypotValue] = useState("");
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const formQuery = useQuery({
    queryKey: ["public-form", publicId],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/public/forms/${publicId}`);
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as {
          message?: string;
        } | null;
        throw new Error(body?.message || "Form not found");
      }
      return (await res.json()) as PublicForm;
    },
    enabled: Boolean(publicId),
    retry: false,
  });

  const presentation = useMemo(
    () =>
      formQuery.data
        ? parseLeadFormPresentation(formQuery.data)
        : null,
    [formQuery.data],
  );

  const submitMutation = useMutation({
    mutationFn: async () => {
      const payload: Record<string, string> = { ...values };
      if (honeypotValue) payload.website_url = honeypotValue;
      const res = await fetch(`${API_BASE}/public/forms/${publicId}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as {
          message?: string;
        } | null;
        throw new Error(body?.message || "Submission failed");
      }
      return res.json();
    },
    onSuccess: () => {
      setDone(true);
      setError(null);
    },
    onError: (err: Error) => setError(err.message),
  });

  if (formQuery.isLoading) {
    return (
      <main className="mx-auto flex min-h-full max-w-lg flex-col justify-center p-6">
        <p className="text-muted-foreground text-sm">Loading form…</p>
      </main>
    );
  }

  if (formQuery.isError || !formQuery.data || !presentation) {
    return (
      <main className="mx-auto flex min-h-full max-w-lg flex-col justify-center gap-2 p-6">
        <h1 className="text-xl font-semibold">Form unavailable</h1>
        <p className="text-muted-foreground text-sm">
          {(formQuery.error as Error)?.message || "This form was not found."}
        </p>
      </main>
    );
  }

  if (done) {
    return (
      <main className="mx-auto flex min-h-full max-w-lg flex-col justify-center gap-2 p-6">
        <h1 className="text-xl font-semibold">Thanks</h1>
        <p className="text-muted-foreground text-sm">
          Your submission was received.
        </p>
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-full max-w-lg flex-col justify-center gap-6 p-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">
          {presentation.name}
        </h1>
        {presentation.description ? (
          <p className="text-muted-foreground mt-1 text-sm">
            {presentation.description}
          </p>
        ) : null}
      </div>

      {error ? <p className="text-destructive text-sm">{error}</p> : null}

      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          submitMutation.mutate();
        }}
      >
        {presentation.fields.map((field) => (
          <div key={field.key} className="space-y-2">
            <Label htmlFor={`pf-${field.key}`}>
              {field.label}
              {field.required ? " *" : ""}
            </Label>
            <Input
              id={`pf-${field.key}`}
              type={inputTypeForField(field.type)}
              required={field.required}
              value={values[field.key] ?? ""}
              onChange={(e) =>
                setValues((prev) => ({
                  ...prev,
                  [field.key]: e.target.value,
                }))
              }
            />
          </div>
        ))}

        {presentation.honeypot ? (
          <div className="hidden" aria-hidden>
            <Input
              tabIndex={-1}
              autoComplete="off"
              value={honeypotValue}
              onChange={(e) => setHoneypotValue(e.target.value)}
            />
          </div>
        ) : null}

        <Button type="submit" disabled={submitMutation.isPending}>
          {presentation.submitLabel}
        </Button>
      </form>
    </main>
  );
}
