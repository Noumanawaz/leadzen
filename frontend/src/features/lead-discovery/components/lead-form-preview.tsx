"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  inputTypeForField,
  type LeadFormPresentation,
} from "../lib/lead-form-fields";

type LeadFormPreviewProps = {
  presentation: LeadFormPresentation;
  interactive?: boolean;
};

export function LeadFormPreview({
  presentation,
  interactive = false,
}: LeadFormPreviewProps) {
  return (
    <div className="bg-background space-y-5 rounded-lg border p-5 shadow-sm">
      <div>
        <h3 className="text-lg font-semibold tracking-tight">
          {presentation.name || "Untitled form"}
        </h3>
        {presentation.description ? (
          <p className="text-muted-foreground mt-1 text-sm">
            {presentation.description}
          </p>
        ) : null}
      </div>

      <div className="space-y-4">
        {presentation.fields.map((field) => (
          <div key={field.key} className="space-y-2">
            <Label htmlFor={`preview-${field.key}`}>
              {field.label}
              {field.required ? " *" : ""}
            </Label>
            <Input
              id={`preview-${field.key}`}
              type={inputTypeForField(field.type)}
              placeholder={field.label}
              required={field.required}
              readOnly={!interactive}
              tabIndex={interactive ? undefined : -1}
            />
          </div>
        ))}

        {presentation.honeypot ? (
          <div className="hidden" aria-hidden>
            <Input tabIndex={-1} autoComplete="off" readOnly />
          </div>
        ) : null}

        <Button type="button" disabled={!interactive} className="w-full sm:w-auto">
          {presentation.submitLabel || "Submit"}
        </Button>
      </div>

      {!interactive ? (
        <p className="text-muted-foreground text-xs">
          Preview only — submissions are disabled here.
        </p>
      ) : null}
    </div>
  );
}
