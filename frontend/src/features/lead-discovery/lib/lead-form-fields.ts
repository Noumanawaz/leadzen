export type LeadFormField = {
  key: string;
  label: string;
  type: "text" | "email" | "tel";
  required: boolean;
};

export type LeadFormPresentation = {
  name: string;
  description: string;
  submitLabel: string;
  fields: LeadFormField[];
  honeypot: boolean;
};

export const DEFAULT_FORM_FIELDS: LeadFormField[] = [
  { key: "email", label: "Email", type: "email", required: true },
  { key: "firstName", label: "First name", type: "text", required: false },
  { key: "lastName", label: "Last name", type: "text", required: false },
  { key: "companyName", label: "Company", type: "text", required: false },
];

export const STANDARD_FIELD_OPTIONS: Array<{
  key: string;
  label: string;
  type: LeadFormField["type"];
}> = [
  { key: "email", label: "Email", type: "email" },
  { key: "firstName", label: "First name", type: "text" },
  { key: "lastName", label: "Last name", type: "text" },
  { key: "phone", label: "Phone", type: "tel" },
  { key: "companyName", label: "Company", type: "text" },
  { key: "website", label: "Website", type: "text" },
];

const FIELD_TYPE_SET = new Set(["text", "email", "tel"]);

function asFieldType(value: unknown): LeadFormField["type"] {
  const raw = String(value ?? "text");
  if (FIELD_TYPE_SET.has(raw)) return raw as LeadFormField["type"];
  if (raw === "phone") return "tel";
  return "text";
}

export function normalizeLeadFormFields(fields: unknown): LeadFormField[] {
  if (!Array.isArray(fields) || !fields.length) return DEFAULT_FORM_FIELDS;
  const normalized = fields
    .map((f) => {
      if (!f || typeof f !== "object") return null;
      const row = f as Record<string, unknown>;
      const key = String(row.key ?? row.name ?? "").trim();
      if (!key) return null;
      return {
        key,
        label: String(row.label ?? key),
        type: asFieldType(row.type),
        required: Boolean(row.required),
      } satisfies LeadFormField;
    })
    .filter(Boolean) as LeadFormField[];
  return normalized.length ? normalized : DEFAULT_FORM_FIELDS;
}

export function parseLeadFormPresentation(form: {
  name: string;
  fields?: unknown;
  automation?: unknown;
  spamSettings?: unknown;
  description?: string;
  submitLabel?: string;
  honeypot?: boolean;
}): LeadFormPresentation {
  const automation =
    form.automation && typeof form.automation === "object"
      ? (form.automation as Record<string, unknown>)
      : {};
  const spam =
    form.spamSettings && typeof form.spamSettings === "object"
      ? (form.spamSettings as Record<string, unknown>)
      : {};

  return {
    name: form.name,
    description:
      form.description ??
      (typeof automation.description === "string"
        ? automation.description
        : "Fill out the form below and we'll be in touch."),
    submitLabel:
      form.submitLabel ??
      (typeof automation.submitLabel === "string"
        ? automation.submitLabel
        : "Submit"),
    fields: normalizeLeadFormFields(form.fields),
    honeypot:
      form.honeypot ??
      (spam.honeypot === undefined ? true : Boolean(spam.honeypot)),
  };
}

export function inputTypeForField(type: LeadFormField["type"]): string {
  if (type === "email") return "email";
  if (type === "tel") return "tel";
  return "text";
}

export function buildEmbedHtml(
  submitUrl: string,
  fields: LeadFormField[],
  options?: { submitLabel?: string; honeypot?: boolean },
): string {
  const lines = fields.map((field) => {
    const attrs = [
      `name="${field.key}"`,
      `type="${inputTypeForField(field.type)}"`,
      field.required ? "required" : null,
      `placeholder="${field.label}"`,
    ]
      .filter(Boolean)
      .join(" ");
    return `  <input ${attrs} />`;
  });
  if (options?.honeypot !== false) {
    lines.push(`  <input name="website_url" style="display:none" />`);
  }
  lines.push(
    `  <button type="submit">${options?.submitLabel ?? "Send"}</button>`,
  );
  return `<form action="${submitUrl}" method="POST">\n${lines.join("\n")}\n</form>`;
}
