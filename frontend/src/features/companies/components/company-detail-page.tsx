"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { apiClient } from "@/lib/api/client";
import { useGlobalLoaderEffect } from "@/components/global-loader";

type CompanyContactRole =
  | "decision_maker"
  | "champion"
  | "influencer"
  | "gatekeeper"
  | "end_user"
  | "procurement"
  | "other";

type ContactOption = {
  id: string;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  phone: string | null;
  jobTitle: string | null;
};

type CompanyDetail = {
  id: string;
  name: string;
  website: string | null;
  industry: string | null;
  country: string | null;
  employeeCount: number | null;
  description: string | null;
  companyContacts: Array<{
    id: string;
    role: string;
    isPrimary: boolean;
    title: string | null;
    contact: ContactOption;
  }>;
  leads: Array<{
    id: string;
    firstName: string | null;
    lastName: string | null;
    email: string | null;
    status: string;
  }>;
};

function contactLabel(c: ContactOption) {
  return (
    [c.firstName, c.lastName].filter(Boolean).join(" ") ||
    c.email ||
    c.phone ||
    "Untitled"
  );
}

function leadLabel(l: CompanyDetail["leads"][number]) {
  return (
    [l.firstName, l.lastName].filter(Boolean).join(" ") || l.email || "Lead"
  );
}

export function CompanyDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const router = useRouter();
  const queryClient = useQueryClient();

  const [name, setName] = useState("");
  const [website, setWebsite] = useState("");
  const [industry, setIndustry] = useState("");
  const [country, setCountry] = useState("");
  const [message, setMessage] = useState<string | null>(null);

  const [linkContactId, setLinkContactId] = useState("");
  const [linkRole, setLinkRole] =
    useState<CompanyContactRole>("decision_maker");
  const [newFirst, setNewFirst] = useState("");
  const [newLast, setNewLast] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [newTitle, setNewTitle] = useState("");

  const companyQuery = useQuery({
    queryKey: ["company", id],
    queryFn: () => apiClient<CompanyDetail>(`/v1/companies/${id}`),
    enabled: Boolean(id),
  });

  const contactsQuery = useQuery({
    queryKey: ["contacts"],
    queryFn: () => apiClient<ContactOption[]>("/v1/contacts"),
  });

  useEffect(() => {
    const c = companyQuery.data;
    if (!c) return;
    setName(c.name);
    setWebsite(c.website ?? "");
    setIndustry(c.industry ?? "");
    setCountry(c.country ?? "");
  }, [companyQuery.data]);

  useGlobalLoaderEffect(
    "company-detail",
    companyQuery.isLoading && !companyQuery.data,
    "Loading company…",
  );

  const saveMutation = useMutation({
    mutationFn: () =>
      apiClient(`/v1/companies/${id}`, {
        method: "PATCH",
        body: JSON.stringify({
          name,
          website: website || undefined,
          industry: industry || undefined,
          country: country || undefined,
        }),
      }),
    onSuccess: () => {
      setMessage("Company updated.");
      void queryClient.invalidateQueries({ queryKey: ["company", id] });
      void queryClient.invalidateQueries({ queryKey: ["companies"] });
    },
    onError: (err: Error) => setMessage(err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: () =>
      apiClient(`/v1/companies/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["companies"] });
      router.push("/companies");
    },
    onError: (err: Error) => setMessage(err.message),
  });

  const linkExistingMutation = useMutation({
    mutationFn: () =>
      apiClient(`/v1/companies/${id}/contacts`, {
        method: "POST",
        body: JSON.stringify({ contactId: linkContactId, role: linkRole }),
      }),
    onSuccess: () => {
      setLinkContactId("");
      setMessage("Contact linked.");
      void queryClient.invalidateQueries({ queryKey: ["company", id] });
    },
    onError: (err: Error) => setMessage(err.message),
  });

  const createAndLinkMutation = useMutation({
    mutationFn: async () => {
      const contact = await apiClient<ContactOption>("/v1/contacts", {
        method: "POST",
        body: JSON.stringify({
          firstName: newFirst || undefined,
          lastName: newLast || undefined,
          email: newEmail || undefined,
          phone: newPhone || undefined,
          jobTitle: newTitle || undefined,
        }),
      });
      await apiClient(`/v1/companies/${id}/contacts`, {
        method: "POST",
        body: JSON.stringify({
          contactId: contact.id,
          role: linkRole,
        }),
      });
      return contact;
    },
    onSuccess: () => {
      setNewFirst("");
      setNewLast("");
      setNewEmail("");
      setNewPhone("");
      setNewTitle("");
      setMessage("Contact created and linked.");
      void queryClient.invalidateQueries({ queryKey: ["company", id] });
      void queryClient.invalidateQueries({ queryKey: ["contacts"] });
    },
    onError: (err: Error) => setMessage(err.message),
  });

  const company = companyQuery.data;

  if (companyQuery.isError) {
    return (
      <main className="flex flex-1 flex-col gap-4 p-6">
        <p className="text-destructive text-sm">
          {(companyQuery.error as Error).message || "Company not found"}
        </p>
        <Link href="/companies" className="text-sm underline">
          Back to companies
        </Link>
      </main>
    );
  }

  return (
    <main className="flex flex-1 flex-col gap-6 p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link
            href="/companies"
            className="text-muted-foreground text-xs hover:underline"
          >
            ← Companies
          </Link>
          <h1 className="mt-1 text-xl font-semibold tracking-tight">
            {company?.name ?? "Company"}
          </h1>
        </div>
        <Button
          variant="destructive"
          size="sm"
          disabled={deleteMutation.isPending}
          onClick={() => {
            if (
              !window.confirm(
                `Delete "${company?.name}"? This cannot be undone.`,
              )
            )
              return;
            deleteMutation.mutate();
          }}
        >
          Delete
        </Button>
      </div>

      {message ? (
        <p className="bg-muted/40 rounded-md px-3 py-2 text-sm">{message}</p>
      ) : null}

      <section className="border-border space-y-3 rounded-lg border p-4">
        <h2 className="text-sm font-medium">Details</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <Input
            placeholder="Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <Input
            placeholder="Website"
            value={website}
            onChange={(e) => setWebsite(e.target.value)}
          />
          <Input
            placeholder="Industry"
            value={industry}
            onChange={(e) => setIndustry(e.target.value)}
          />
          <Input
            placeholder="Country"
            value={country}
            onChange={(e) => setCountry(e.target.value)}
          />
        </div>
        <Button
          onClick={() => saveMutation.mutate()}
          disabled={!name.trim() || saveMutation.isPending}
        >
          Save
        </Button>
      </section>

      <section className="border-border space-y-3 rounded-lg border p-4">
        <h2 className="text-sm font-medium">Contacts</h2>
        <ul className="space-y-2 text-sm">
          {(company?.companyContacts ?? []).map((cc) => (
            <li
              key={cc.id}
              className="flex flex-wrap justify-between gap-2 border-b border-border/50 py-2"
            >
              <span>
                {contactLabel(cc.contact)}
                {cc.contact.email ? ` · ${cc.contact.email}` : ""}
              </span>
              <span className="text-muted-foreground capitalize">
                {cc.role.replaceAll("_", " ")}
              </span>
            </li>
          ))}
          {!company?.companyContacts?.length ? (
            <li className="text-muted-foreground">No contacts linked</li>
          ) : null}
        </ul>

        <div className="grid gap-3 border-t border-border/60 pt-3 sm:grid-cols-3">
          <select
            className="border-input bg-background h-9 rounded-md border px-3 text-sm"
            value={linkContactId}
            onChange={(e) => setLinkContactId(e.target.value)}
          >
            <option value="">Existing contact…</option>
            {(contactsQuery.data ?? []).map((c) => (
              <option key={c.id} value={c.id}>
                {contactLabel(c)}
              </option>
            ))}
          </select>
          <select
            className="border-input bg-background h-9 rounded-md border px-3 text-sm"
            value={linkRole}
            onChange={(e) =>
              setLinkRole(e.target.value as CompanyContactRole)
            }
          >
            <option value="decision_maker">Decision maker</option>
            <option value="champion">Champion</option>
            <option value="influencer">Influencer</option>
            <option value="gatekeeper">Gatekeeper</option>
            <option value="end_user">End user</option>
            <option value="procurement">Procurement</option>
            <option value="other">Other</option>
          </select>
          <Button
            variant="secondary"
            disabled={!linkContactId || linkExistingMutation.isPending}
            onClick={() => linkExistingMutation.mutate()}
          >
            Link contact
          </Button>
        </div>

        <div className="grid gap-3 border-t border-border/60 pt-3 sm:grid-cols-2 lg:grid-cols-3">
          <Input
            placeholder="First name"
            value={newFirst}
            onChange={(e) => setNewFirst(e.target.value)}
          />
          <Input
            placeholder="Last name"
            value={newLast}
            onChange={(e) => setNewLast(e.target.value)}
          />
          <Input
            placeholder="Email"
            value={newEmail}
            onChange={(e) => setNewEmail(e.target.value)}
          />
          <Input
            placeholder="Phone"
            value={newPhone}
            onChange={(e) => setNewPhone(e.target.value)}
          />
          <Input
            placeholder="Job title"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
          />
          <Button
            disabled={
              (!newFirst && !newLast && !newEmail && !newPhone) ||
              createAndLinkMutation.isPending
            }
            onClick={() => createAndLinkMutation.mutate()}
          >
            Create & link
          </Button>
        </div>
      </section>

      <section className="border-border space-y-3 rounded-lg border p-4">
        <h2 className="text-sm font-medium">Leads</h2>
        <ul className="space-y-2 text-sm">
          {(company?.leads ?? []).map((l) => (
            <li key={l.id} className="flex justify-between gap-2 py-1">
              <Link
                href={`/leads/${l.id}`}
                className="underline-offset-2 hover:underline"
              >
                {leadLabel(l)}
              </Link>
              <span className="text-muted-foreground capitalize">
                {l.status}
              </span>
            </li>
          ))}
          {!company?.leads?.length ? (
            <li className="text-muted-foreground">No leads for this company</li>
          ) : null}
        </ul>
      </section>
    </main>
  );
}
