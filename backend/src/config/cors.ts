const LOCAL_ORIGIN_PATTERN =
  /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i;
const VERCEL_ORIGIN_PATTERN = /^https:\/\/[a-z0-9-]+\.vercel\.app$/i;

export function parseCsvOrigins(value?: string): string[] {
  if (!value?.trim()) return [];
  return value
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
}

export function isAllowedCorsOrigin(
  origin: string | undefined,
  allowedOrigins: string[],
): boolean {
  if (!origin) return true;
  if (allowedOrigins.includes(origin)) return true;
  if (LOCAL_ORIGIN_PATTERN.test(origin)) return true;
  if (VERCEL_ORIGIN_PATTERN.test(origin)) return true;
  return false;
}

export function buildAllowedCorsOrigins(
  frontendUrl: string,
  extraOrigins?: string,
): string[] {
  return [...new Set([frontendUrl, ...parseCsvOrigins(extraOrigins)])];
}
