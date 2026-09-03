"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { apiClient } from "@/lib/api/client";
import {
  parseLeadFormPresentation,
  STANDARD_FIELD_OPTIONS,
  type LeadFormField,
  type LeadFormPresentation,
} from "../lib/lead-form-fields";
import { LeadFormPreview } from "./lead-form-preview";

export type LeadFormRecord = {
  id: string;
  publicId: string;
  name: string;
  fields?: unknown;
  automation?: unknown;
  spamSettings?: unknown;
  isActive: boolean;
  submissionCount: number;
};

type LeadFormCustomizeSheetProps = {
  form: LeadFormRecord | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

function ToggleRow({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-start justify-between gap-3 rounded-md border px-3 py-2.5">
      <div className="min-w-0">
        <div className="text-sm font-medium">{label}</div>
        <p className="text-muted-foreground text-xs">{description}</p>
      </div>
      <input
        type="checkbox"
        className="mt-1 size-4 accent-primary"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
    </label>
  );
}

export function LeadFormCustomizeSheet({
  form,
  open,
  onOpenChange,
}: LeadFormCustomizeSheetProps) {
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [submitLabel, setSubmitLabel] = useState("Submit");
  const [fields, setFields] = useState<LeadFormField[]>([]);
  const [honeypot, setHoneypot] = useState(true);
  const [isActive, setIsActive] = useState(true);
  const [addKey, setAddKey] = useState<string>("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !form) return;
    const parsed = parseLeadFormPresentation(form);
    setName(parsed.name);
    setDescription(parsed.description);
    setSubmitLabel(parsed.submitLabel);
    setFields(parsed.fields);
    setHoneypot(parsed.honeypot);
    setIsActive(form.isActive);
    setAddKey("");
    setError(null);
  }, [open, form]);

  const usedKeys = useMemo(() => new Set(fields.map((f) => f.key)), [fields]);
  const availableToAdd = STANDARD_FIELD_OPTIONS.filter(
    (opt) => !usedKeys.has(opt.key),
  );

  const presentation: LeadFormPresentation = {
    name,
    description,
    submitLabel,
    fields,
    honeypot,
  };

  const saveMutation = useMutation({
    mutationFn: () => {
      if (!form) throw new Error("No form selected");
      if (!name.trim()) throw new Error("Name is required");
      if (!fields.length) throw new Error("Add at least one field");
      if (!fields.some((f) => f.key === "email")) {
        throw new Error("Email field is required");
      }
      return apiClient(`/v1/lead-forms/${form.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          name: name.trim(),
          fields: fields.map((f) => ({
            key: f.key,
            label: f.label.trim() || f.key,
            type: f.type,
            required: f.required,
          })),
          automation: {
            description: description.trim(),
            submitLabel: submitLabel.trim() || "Submit",
          },
          spamSettings: { honeypot },
          isActive,
        }),
      });
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["lead-forms"] });
      onOpenChange(false);
    },
    onError: (err: Error) => setError(err.message),
  });

  function updateField(index: number, patch: Partial<LeadFormField>) {
    setFields((prev) =>
      prev.map((field, i) => (i === index ? { ...field, ...patch } : field)),
    );
  }

  function moveField(index: number, direction: -1 | 1) {
    setFields((prev) => {
      const next = [...prev];
      const target = index + direction;
      if (target < 0 || target >= next.length) return prev;
      const tmp = next[index]!;
      next[index] = next[target]!;
      next[target] = tmp;
      return next;
    });
  }

  function removeField(index: number) {
    setFields((prev) => prev.filter((_, i) => i !== index));
  }

  function addField() {
    const option = STANDARD_FIELD_OPTIONS.find((o) => o.key === addKey);
    if (!option || usedKeys.has(option.key)) return;
    setFields((prev) => [
      ...prev,
      {
        key: option.key,
        label: option.label,
        type: option.type,
        required: option.key === "email",
      },
    ]);
    setAddKey("");
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex h-full w-full max-w-none flex-col overflow-y-auto px-6 pb-8 data-[side=right]:w-full data-[side=right]:max-w-none data-[side=right]:sm:max-w-none sm:px-8 sm:pl-10 md:w-[min(96vw,1400px)] md:data-[side=right]:w-[min(96vw,1400px)]">
        <SheetHeader className="p-0 pr-10">
          <SheetTitle>Customize form</SheetTitle>
          <SheetDescription>
            Edit fields and copy, then check the live preview before saving.
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 grid grid-cols-1 gap-8 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
          <div className="min-w-0 space-y-5">
            <div className="space-y-2">
              <Label htmlFor="lf-name">Form name</Label>
              <Input
                id="lf-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="lf-description">Description</Label>
              <Textarea
                id="lf-description"
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="lf-submit">Submit button label</Label>
              <Input
                id="lf-submit"
                value={submitLabel}
                onChange={(e) => setSubmitLabel(e.target.value)}
              />
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between gap-2">
                <Label>Fields</Label>
                <span className="text-muted-foreground text-xs">
                  {fields.length} field{fields.length === 1 ? "" : "s"}
                </span>
              </div>

              <ul className="space-y-3">
                {fields.map((field, index) => (
                  <li
                    key={field.key}
                    className="space-y-3 rounded-lg border p-3"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <code className="text-muted-foreground text-xs">
                        {field.key}
                      </code>
                      <div className="flex items-center gap-1">
                        <Button
                          type="button"
                          size="icon-sm"
                          variant="ghost"
                          disabled={index === 0}
                          onClick={() => moveField(index, -1)}
                          aria-label="Move up"
                        >
                          <ArrowUp className="size-3.5" />
                        </Button>
                        <Button
                          type="button"
                          size="icon-sm"
                          variant="ghost"
                          disabled={index === fields.length - 1}
                          onClick={() => moveField(index, 1)}
                          aria-label="Move down"
                        >
                          <ArrowDown className="size-3.5" />
                        </Button>
                        <Button
                          type="button"
                          size="icon-sm"
                          variant="ghost"
                          disabled={field.key === "email"}
                          onClick={() => removeField(index)}
                          aria-label="Remove field"
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      </div>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor={`lf-label-${field.key}`}>Label</Label>
                        <Input
                          id={`lf-label-${field.key}`}
                          value={field.label}
                          onChange={(e) =>
                            updateField(index, { label: e.target.value })
                          }
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Type</Label>
                        <Select
                          value={field.type}
                          onValueChange={(v) =>
                            updateField(index, {
                              type: (v as LeadFormField["type"]) ?? "text",
                            })
                          }
                        >
                          <SelectTrigger className="w-full">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="text">Text</SelectItem>
                            <SelectItem value="email">Email</SelectItem>
                            <SelectItem value="tel">Phone</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        className="size-4 accent-primary"
                        checked={field.required}
                        onChange={(e) =>
                          updateField(index, { required: e.target.checked })
                        }
                      />
                      Required
                    </label>
                  </li>
                ))}
              </ul>

              {availableToAdd.length ? (
                <div className="flex flex-col gap-2 sm:flex-row">
                  <Select
                    value={addKey || undefined}
                    onValueChange={(v) => setAddKey(v ?? "")}
                  >
                    <SelectTrigger className="w-full flex-1">
                      <SelectValue placeholder="Add a field…" />
                    </SelectTrigger>
                    <SelectContent>
                      {availableToAdd.map((opt) => (
                        <SelectItem key={opt.key} value={opt.key}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    type="button"
                    variant="secondary"
                    disabled={!addKey}
                    onClick={addField}
                  >
                    <Plus className="size-4" />
                    Add
                  </Button>
                </div>
              ) : (
                <p className="text-muted-foreground text-xs">
                  All standard fields are already on this form.
                </p>
              )}
            </div>

            <div className="space-y-2">
              <ToggleRow
                label="Active"
                description="Inactive forms return “not found” on the public URL."
                checked={isActive}
                onChange={setIsActive}
              />
              <ToggleRow
                label="Honeypot spam trap"
                description="Adds a hidden website_url field bots often fill."
                checked={honeypot}
                onChange={setHoneypot}
              />
            </div>

            {error ? <p className="text-destructive text-sm">{error}</p> : null}

            <div className="flex flex-wrap gap-2">
              <Button
                onClick={() => {
                  setError(null);
                  saveMutation.mutate();
                }}
                disabled={saveMutation.isPending}
              >
                {saveMutation.isPending ? "Saving…" : "Save changes"}
              </Button>
              <Button
                type="button"
                variant="secondary"
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>
            </div>
          </div>

          <div className="min-w-0 space-y-3 xl:sticky xl:top-0 xl:self-start">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-sm font-medium">Live preview</h3>
              {form ? (
                <a
                  className="text-primary text-xs underline-offset-2 hover:underline"
                  href={`/public/forms/${form.publicId}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  Open public page
                </a>
              ) : null}
            </div>
            <div className="bg-muted/40 rounded-xl border p-4">
              <LeadFormPreview presentation={presentation} />
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
