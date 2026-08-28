/** Normalize a phone string to E.164 (+digits) when possible. */
export function toE164(phone: string | null | undefined): string | null {
  if (!phone?.trim()) return null;
  const trimmed = phone.trim();
  const digits = trimmed.replace(/\D/g, '');
  if (digits.length < 8) return null;
  if (trimmed.startsWith('+')) return `+${digits}`;
  return `+${digits}`;
}
