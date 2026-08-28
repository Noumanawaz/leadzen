"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { apiClient } from "@/lib/api/client";

type ContactRow = {
  id: string;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  phone: string | null;
  jobTitle: string | null;
};

type CompanyRow = { id: string; name: string };

type CompanyContactRole = "decision_maker" | "champion";

function contactLabel(c: ContactRow) {
  return (
    [c.firstName, c.lastName].filter(Boolean).join(" ") ||
    c.email ||
    c.phone ||
    "Untitled"
  );
}

export function ContactsPage() {
  const queryClient = useQueryClient();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [companyId, setCompanyId] = useState("");
  const [role, setRole] = useState<CompanyContactRole>("decision_maker");
  const [message, setMessage] = useState<string | null>(null);

  const contactsQuery = useQuery({
    queryKey: ["contacts"],
    queryFn: () => apiClient<ContactRow[]>("/v1/contacts"),
  });

  const companiesQuery = useQuery({
    queryKey: ["companies"],
    queryFn: () => apiClient<CompanyRow[]>("/v1/companies"),
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const contact = await apiClient<ContactRow>("/v1/contacts", {
        method: "POST",
        body: JSON.stringify({
          firstName: firstName || undefined,
          lastName: lastName || undefined,
          email: email || undefined,
          phone: phone || undefined,
          jobTitle: jobTitle || undefined,
        }),
      });
      if (companyId) {
        await apiClient(`/v1/companies/${companyId}/contacts`, {
          method: "POST",
          body: JSON.stringify({ contactId: contact.id, role }),
        });
      }
      return contact;
    },
    onSuccess: (contact) => {
      setFirstName("");
      setLastName("");
      setEmail("");
      setPhone("");
      setJobTitle("");
      setCompanyId("");
      setMessage(
        `Created ${contactLabel(contact)}${
          companyId ? " and linked to company" : ""
        }.`,
      );
      void queryClient.invalidateQueries({ queryKey: ["contacts"] });
      void queryClient.invalidateQueries({ queryKey: ["companies"] });
    },
    onError: (err: Error) => setMessage(err.message),
  });

  return (
    <main className="flex flex-1 flex-col gap-6 p-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Contacts</h1>
        <p className="text-muted-foreground text-sm">
          People at accounts — optionally link to a company with a buying role
        </p>
      </div>

      {message ? (
        <p className="bg-muted/40 rounded-md px-3 py-2 text-sm">{message}</p>
      ) : null}

      <section className="border-border space-y-3 rounded-lg border p-4">
        <h2 className="text-sm font-medium">Add contact</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Input
            placeholder="First name"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
          />
          <Input
            placeholder="Last name"
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
          />
          <Input
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <Input
            placeholder="Phone"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />
          <Input
            placeholder="Job title"
            value={jobTitle}
            onChange={(e) => setJobTitle(e.target.value)}
          />
          <select
            className="border-input bg-background h-9 rounded-md border px-3 text-sm"
            value={companyId}
            onChange={(e) => setCompanyId(e.target.value)}
          >
            <option value="">Company (optional)…</option>
            {(companiesQuery.data ?? []).map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          {companyId ? (
            <select
              className="border-input bg-background h-9 rounded-md border px-3 text-sm"
              value={role}
              onChange={(e) => setRole(e.target.value as CompanyContactRole)}
            >
              <option value="decision_maker">Decision maker</option>
              <option value="champion">Champion</option>
            </select>
          ) : null}
          <Button
            onClick={() => createMutation.mutate()}
            disabled={
              (!firstName && !lastName && !email && !phone) ||
              createMutation.isPending
            }
          >
            Create
          </Button>
        </div>
      </section>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="text-muted-foreground border-b">
            <tr>
              <th className="py-2 pr-4 font-medium">Name</th>
              <th className="py-2 pr-4 font-medium">Email</th>
              <th className="py-2 pr-4 font-medium">Phone</th>
              <th className="py-2 font-medium">Title</th>
            </tr>
          </thead>
          <tbody>
            {(contactsQuery.data ?? []).map((row) => (
              <tr key={row.id} className="border-b border-border/60">
                <td className="py-2 pr-4 font-medium">{contactLabel(row)}</td>
                <td className="py-2 pr-4">{row.email ?? "—"}</td>
                <td className="py-2 pr-4">{row.phone ?? "—"}</td>
                <td className="py-2">{row.jobTitle ?? "—"}</td>
              </tr>
            ))}
            {!contactsQuery.data?.length ? (
              <tr>
                <td colSpan={4} className="text-muted-foreground py-6">
                  No contacts yet
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </main>
  );
}
