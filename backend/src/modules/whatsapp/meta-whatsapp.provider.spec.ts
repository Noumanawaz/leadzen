import { extractWhatsAppWebhookEventIds } from './meta-whatsapp.provider';

describe('extractWhatsAppWebhookEventIds', () => {
  it('uses message ids with phone number scope', () => {
    const ids = extractWhatsAppWebhookEventIds({
      entry: [
        {
          id: 'waba-1',
          changes: [
            {
              value: {
                metadata: { phone_number_id: 'phone-1' },
                messages: [{ id: 'wamid.in.1' }],
              },
            },
          ],
        },
      ],
    });
    expect(ids).toEqual(['phone-1:message:wamid.in.1']);
  });

  it('uses status ids with status value', () => {
    const ids = extractWhatsAppWebhookEventIds({
      entry: [
        {
          changes: [
            {
              value: {
                metadata: { phone_number_id: 'phone-1' },
                statuses: [{ id: 'wamid.out.1', status: 'delivered' }],
              },
            },
          ],
        },
      ],
    });
    expect(ids).toEqual(['phone-1:status:wamid.out.1:delivered']);
  });

  it('falls back to waba entry id when no granular ids exist', () => {
    const ids = extractWhatsAppWebhookEventIds({
      entry: [{ id: 'waba-99', changes: [{ value: {} }] }],
    });
    expect(ids).toEqual(['waba:waba-99']);
  });
});
