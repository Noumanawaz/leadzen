"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { apiClient } from "@/lib/api/client";

type CompanyRow = {
  id: string;
  name: string;
  website: string | null;
  industry: string | null;
  country: string | null;
  _count?: { leads: number; companyContacts: number };
};

export function CompaniesPage() {
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [website, setWebsite] = useState("");
  const [industry, setIndustry] = useState("");

  const companiesQuery = useQuery({
    queryKey: ["companies"],
    queryFn: () => apiClient<CompanyRow[]>("/v1/companies"),
  });

  const createMutation = useMutation({
    mutationFn: () =>
      apiClient("/v1/companies", {
        method: "POST",
        body: JSON.stringify({ name, website, industry }),
      }),
    onSuccess: () => {
      setName("");
      setWebsite("");
      setIndustry("");
      void queryClient.invalidateQueries({ queryKey: ["companies"] });
    },
  });

  return (
    <main className="flex flex-1 flex-col gap-6 p-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Companies</h1>
        <p className="text-muted-foreground text-sm">
          Accounts and buying committees
        </p>
      </div>

      <section className="border-border space-y-3 rounded-lg border p-4">
        <h2 className="text-sm font-medium">Add company</h2>
        <div className="grid gap-3 sm:grid-cols-4">
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
          <Button
            onClick={() => createMutation.mutate()}
            disabled={!name || createMutation.isPending}
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
              <th className="py-2 pr-4 font-medium">Website</th>
              <th className="py-2 pr-4 font-medium">Industry</th>
              <th className="py-2 pr-4 font-medium">Leads</th>
              <th className="py-2 font-medium">Contacts</th>
            </tr>
          </thead>
          <tbody>
            {(companiesQuery.data ?? []).map((row) => (
              <tr key={row.id} className="border-b border-border/60">
                <td className="py-2 pr-4 font-medium">
                  <Link
                    href={`/companies/${row.id}`}
                    className="underline-offset-2 hover:underline"
                  >
                    {row.name}
                  </Link>
                </td>
                <td className="py-2 pr-4">{row.website ?? "—"}</td>
                <td className="py-2 pr-4">{row.industry ?? "—"}</td>
                <td className="py-2 pr-4">{row._count?.leads ?? 0}</td>
                <td className="py-2">{row._count?.companyContacts ?? 0}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}
