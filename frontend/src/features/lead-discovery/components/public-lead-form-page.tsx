"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import { useParams } from "next/navigation";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api";

type PublicForm = {
  publicId: string;
  name: string;
  fields?: unknown;
};

type FormField = {
  name: string;
  label?: string;
  type?: string;
  required?: boolean;
};

const DEFAULT_FIELDS: FormField[] = [
  { name: "firstName", label: "First name" },
  { name: "lastName", label: "Last name" },
  { name: "email", label: "Email", type: "email", required: true },
  { name: "phone", label: "Phone" },
  { name: "companyName", label: "Company" },
];

function normalizeFields(fields: unknown): FormField[] {
  if (!Array.isArray(fields) || !fields.length) return DEFAULT_FIELDS;
  return fields
    .map((f) => {
      if (!f || typeof f !== "object") return null;
      const row = f as Record<string, unknown>;
      const name = String(row.name ?? row.key ?? "");
      if (!name) return null;
      return {
        name,
        label: String(row.label ?? name),
        type: String(row.type ?? "text"),
        required: Boolean(row.required),
      } satisfies FormField;
    })
    .filter(Boolean) as FormField[];
}

export function PublicLeadFormPage() {
  const params = useParams<{ publicId: string }>();
  const publicId = params.publicId;
  const [values, setValues] = useState<Record<string, string>>({});
  const [honeypot, setHoneypot] = useState("");
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

  const fields = useMemo(
    () => normalizeFields(formQuery.data?.fields),
    [formQuery.data?.fields],
  );

  const submitMutation = useMutation({
    mutationFn: async () => {
      const payload: Record<string, string> = { ...values };
      if (honeypot) payload.website_url = honeypot;
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

  if (formQuery.isError || !formQuery.data) {
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
          {formQuery.data.name}
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Fill out the form below and we&apos;ll be in touch.
        </p>
      </div>

      {error ? <p className="text-destructive text-sm">{error}</p> : null}

      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          submitMutation.mutate();
        }}
      >
        {fields.map((field) => (
          <div key={field.name} className="space-y-2">
            <Label htmlFor={`pf-${field.name}`}>
              {field.label ?? field.name}
              {field.required ? " *" : ""}
            </Label>
            <Input
              id={`pf-${field.name}`}
              type={field.type === "email" ? "email" : "text"}
              required={field.required}
              value={values[field.name] ?? ""}
              onChange={(e) =>
                setValues((prev) => ({
                  ...prev,
                  [field.name]: e.target.value,
                }))
              }
            />
          </div>
        ))}

        <div className="hidden" aria-hidden>
          <Input
            tabIndex={-1}
            autoComplete="off"
            value={honeypot}
            onChange={(e) => setHoneypot(e.target.value)}
          />
        </div>

        <Button type="submit" disabled={submitMutation.isPending}>
          Submit
        </Button>
      </form>
    </main>
  );
}
