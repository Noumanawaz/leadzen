"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FileSpreadsheet, Upload } from "lucide-react";
import Link from "next/link";
import { useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { apiClient, ApiError } from "@/lib/api/client";
import { authStorage } from "@/lib/auth/auth-storage";
import { cn } from "@/lib/utils";
import {
  CreditBalanceBanner,
  CreditCostNote,
} from "./credit-cost-note";
import { useFindLeadsPricing } from "../hooks/use-find-leads-pricing";

type ImportJob = {
  id: string;
  filename: string;
  status: string;
  totalRows: number;
  validRows: number;
  importedRows: number;
  skippedRows: number;
  failedRows: number;
  headers?: string[] | null;
  mapping?: Record<string, string> | null;
  rawPreview?: {
    preview?: string[][];
    validationPreview?: unknown[];
  } | null;
  duplicatePolicy?: string;
};

const TARGET_FIELDS = [
  "",
  "firstName",
  "lastName",
  "email",
  "phone",
  "jobTitle",
  "website",
  "companyName",
  "city",
  "state",
  "country",
];

export function CsvImportPage() {
  const queryClient = useQueryClient();
  const pricingQuery = useFindLeadsPricing();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [job, setJob] = useState<ImportJob | null>(null);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [policy, setPolicy] = useState("skip");
  const [message, setMessage] = useState<string | null>(null);
  const [selectedName, setSelectedName] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);

  const headers = useMemo(
    () => (job?.headers as string[] | undefined) ?? [],
    [job],
  );

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const form = new FormData();
      form.append("file", file);
      const token = authStorage.getAccessToken();
      const orgId = authStorage.getOrganizationId();
      const base = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api";
      const res = await fetch(`${base}/v1/leads/imports`, {
        method: "POST",
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          ...(orgId ? { "X-Organization-Id": orgId } : {}),
        },
        body: form,
        credentials: "include",
      });
      if (!res.ok) {
        const body = await res.json().catch(() => undefined);
        throw new ApiError("Upload failed", res.status, body);
      }
      return (await res.json()) as ImportJob;
    },
    onSuccess: (data) => {
      setJob(data);
      setSelectedName(data.filename);
      setMapping((data.mapping as Record<string, string>) ?? {});
      setMessage(`Uploaded ${data.filename} (${data.totalRows} rows)`);
    },
    onError: (err: Error) => setMessage(err.message),
  });

  function handleFile(file: File | undefined | null) {
    if (!file) return;
    setSelectedName(file.name);
    uploadMutation.mutate(file);
  }

  const mapMutation = useMutation({
    mutationFn: () =>
      apiClient<ImportJob>(`/v1/leads/imports/${job!.id}/mapping`, {
        method: "PATCH",
        body: JSON.stringify({ mapping, duplicatePolicy: policy }),
      }),
    onSuccess: (data) => {
      setJob(data);
      setMessage("Mapping saved");
    },
    onError: (err: Error) => setMessage(err.message),
  });

  const startMutation = useMutation({
    mutationFn: () =>
      apiClient<ImportJob>(`/v1/leads/imports/${job!.id}/start`, {
        method: "POST",
      }),
    onSuccess: (data) => {
      setJob(data);
      setMessage("Import started");
      void queryClient.invalidateQueries({ queryKey: ["lead-imports"] });
      void queryClient.invalidateQueries({ queryKey: ["credits"] });
      void queryClient.invalidateQueries({
        queryKey: ["find-leads-credit-costs"],
      });
    },
    onError: (err: Error) => setMessage(err.message),
  });

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Import CSV / Excel
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Upload, map columns, preview duplicates, then start the job.
            Each imported lead debits platform credits.
          </p>
          <CreditBalanceBanner
            pricing={pricingQuery.data}
            className="text-muted-foreground mt-2 text-sm"
          />
        </div>
        <Link
          href="/leads/imports"
          className="text-muted-foreground text-sm hover:underline"
        >
          Import history
        </Link>
      </div>

      <div
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            fileInputRef.current?.click();
          }
        }}
        onClick={() => fileInputRef.current?.click()}
        onDragEnter={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={(e) => {
          e.preventDefault();
          setDragging(false);
        }}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          handleFile(e.dataTransfer.files?.[0]);
        }}
        className={cn(
          "border-border bg-muted/40 hover:bg-muted/70 flex cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed px-6 py-10 text-center transition-colors",
          dragging && "border-primary bg-primary/10",
          uploadMutation.isPending && "pointer-events-none opacity-70",
        )}
      >
        <div className="bg-background text-foreground flex size-12 items-center justify-center rounded-full border shadow-sm">
          {selectedName ? (
            <FileSpreadsheet className="size-5" />
          ) : (
            <Upload className="size-5" />
          )}
        </div>
        <div className="space-y-1">
          <p className="text-sm font-medium">
            {uploadMutation.isPending
              ? "Uploading…"
              : selectedName
                ? selectedName
                : "Drop your CSV or Excel file here"}
          </p>
          <p className="text-muted-foreground text-xs">
            .csv, .xlsx, or .xls · click anywhere in this box to browse
          </p>
        </div>
        <Button
          type="button"
          className="pointer-events-none"
          tabIndex={-1}
          disabled={uploadMutation.isPending}
        >
          {uploadMutation.isPending ? "Uploading…" : "Choose file"}
        </Button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv,.xlsx,.xls,text/csv"
          className="sr-only"
          onChange={(e) => {
            handleFile(e.target.files?.[0]);
            e.target.value = "";
          }}
        />
      </div>

      {job ? (
        <div className="space-y-4">
          <div className="text-sm">
            Job <span className="font-mono">{job.id}</span> · {job.status} ·{" "}
            {job.totalRows} rows
          </div>

          <div className="space-y-2">
            <div className="text-sm font-medium">Column mapping</div>
            {headers.map((header) => (
              <div key={header} className="flex items-center gap-2 text-sm">
                <span className="w-40 truncate font-mono">{header}</span>
                <select
                  className="border-input bg-background rounded-md border px-2 py-1"
                  value={mapping[header] ?? ""}
                  onChange={(e) =>
                    setMapping((prev) => ({
                      ...prev,
                      [header]: e.target.value,
                    }))
                  }
                >
                  {TARGET_FIELDS.map((f) => (
                    <option key={f || "skip"} value={f}>
                      {f || "(ignore)"}
                    </option>
                  ))}
                </select>
              </div>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <label className="text-sm">Duplicates</label>
            <select
              className="border-input bg-background rounded-md border px-2 py-1 text-sm"
              value={policy}
              onChange={(e) => setPolicy(e.target.value)}
            >
              <option value="skip">Skip</option>
              <option value="merge">Merge</option>
              <option value="update">Update</option>
              <option value="create">Create anyway</option>
            </select>
            <Button
              variant="secondary"
              onClick={() => mapMutation.mutate()}
              disabled={mapMutation.isPending}
            >
              Save mapping
            </Button>
            <Button
              onClick={() => startMutation.mutate()}
              disabled={startMutation.isPending}
            >
              Start import
            </Button>
          </div>

          <CreditCostNote
            pricing={pricingQuery.data}
            code="csv_import"
            quantity={job.validRows || job.totalRows}
            prefix="Estimated import cost:"
          />

          {job.rawPreview?.preview?.length ? (
            <div className="overflow-x-auto text-xs">
              <table className="w-full border-collapse">
                <thead>
                  <tr>
                    {headers.map((h) => (
                      <th key={h} className="border p-1 text-left">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {job.rawPreview.preview.slice(0, 5).map((row, i) => (
                    <tr key={i}>
                      {row.map((cell, j) => (
                        <td key={j} className="border p-1">
                          {cell}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </div>
      ) : null}

      {message ? (
        <p className="text-muted-foreground text-sm">{message}</p>
      ) : null}
    </div>
  );
}

export function ImportHistoryPage() {
  const importsQuery = useQuery({
    queryKey: ["lead-imports"],
    queryFn: () => apiClient<ImportJob[]>("/v1/leads/imports"),
  });

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Import history</h1>
        <Link href="/leads/import" className="text-sm hover:underline">
          New import
        </Link>
      </div>
      <ul className="divide-border divide-y rounded-lg border">
        {(importsQuery.data ?? []).map((job) => (
          <li key={job.id} className="flex justify-between gap-4 p-3 text-sm">
            <div>
              <div className="font-medium">{job.filename}</div>
              <div className="text-muted-foreground font-mono text-xs">
                {job.id}
              </div>
            </div>
            <div className="text-right text-xs">
              <div>{job.status}</div>
              <div className="text-muted-foreground">
                +{job.importedRows} / skip {job.skippedRows} / fail{" "}
                {job.failedRows}
              </div>
            </div>
          </li>
        ))}
        {!importsQuery.data?.length ? (
          <li className="text-muted-foreground p-4 text-sm">No imports yet.</li>
        ) : null}
      </ul>
    </div>
  );
}
