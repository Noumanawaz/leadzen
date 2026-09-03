"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { apiClient } from "@/lib/api/client";
import { toE164 } from "../utils/phone";

export type LeadEditTarget = {
  id: string;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  phone: string | null;
  jobTitle?: string | null;
  company?: { name: string } | null;
};

type LeadEditSheetProps = {
  lead: LeadEditTarget | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved?: () => void;
};

export function LeadEditSheet({
  lead,
  open,
  onOpenChange,
  onSaved,
}: LeadEditSheetProps) {
  const queryClient = useQueryClient();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !lead) return;
    setFirstName(lead.firstName ?? "");
    setLastName(lead.lastName ?? "");
    setEmail(lead.email ?? "");
    setPhone(lead.phone ?? "");
    setJobTitle(lead.jobTitle ?? "");
    setError(null);
  }, [open, lead?.id, lead]);

  const saveMutation = useMutation({
    mutationFn: () => {
      const normalizedPhone = phone.trim()
        ? (toE164(phone.trim()) ?? phone.trim())
        : undefined;
      return apiClient(`/v1/leads/${lead!.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          firstName: firstName.trim() || undefined,
          lastName: lastName.trim() || undefined,
          email: email.trim() || undefined,
          phone: normalizedPhone,
          jobTitle: jobTitle.trim() || undefined,
        }),
      });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["leads"] });
      if (lead?.id) {
        void queryClient.invalidateQueries({ queryKey: ["lead", lead.id] });
      }
      onSaved?.();
      onOpenChange(false);
    },
    onError: (err: Error) => setError(err.message),
  });

  const label =
    [lead?.firstName, lead?.lastName].filter(Boolean).join(" ") ||
    lead?.email ||
    lead?.company?.name ||
    "Lead";

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:w-[50vw] sm:max-w-none">
        <SheetHeader>
          <SheetTitle>Edit lead</SheetTitle>
          <SheetDescription>
            Update contact details for {label}. Add a phone number to enable
            WhatsApp and SMS outreach.
          </SheetDescription>
        </SheetHeader>

        <form
          className="mt-6 space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            saveMutation.mutate();
          }}
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="edit-first-name">First name</Label>
              <Input
                id="edit-first-name"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder="Jane"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-last-name">Last name</Label>
              <Input
                id="edit-last-name"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                placeholder="Doe"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-email">Email</Label>
            <Input
              id="edit-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="jane@company.com"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-phone">Phone</Label>
            <Input
              id="edit-phone"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+923001234567"
            />
            <p className="text-muted-foreground text-xs">
              Use international format (E.164), e.g. +923335072284
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-job-title">Job title</Label>
            <Input
              id="edit-job-title"
              value={jobTitle}
              onChange={(e) => setJobTitle(e.target.value)}
              placeholder="Sales manager"
            />
          </div>

          {error ? (
            <p className="text-destructive text-sm">{error}</p>
          ) : null}

          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={saveMutation.isPending}>
              {saveMutation.isPending ? "Saving…" : "Save changes"}
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}
