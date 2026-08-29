import { createHash } from 'crypto';
import { extractWhatsAppWebhookEventIds } from './meta-whatsapp.provider';

export function resolveWebhookEventId(
  payload: Parameters<typeof extractWhatsAppWebhookEventIds>[0],
  rawBody: Buffer,
): string {
  const granularIds = extractWhatsAppWebhookEventIds(payload);
  if (granularIds.length > 0) {
    return granularIds.join('|');
  }
  return `wa_payload_${createHash('sha256').update(rawBody).digest('hex').slice(0, 32)}`;
}
