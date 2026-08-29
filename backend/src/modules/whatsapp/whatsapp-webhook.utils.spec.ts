import { resolveWebhookEventId } from './whatsapp-webhook.utils';

describe('resolveWebhookEventId', () => {
  it('joins granular ids for multi-event payloads', () => {
    const payload = {
      entry: [
        {
          changes: [
            {
              value: {
                metadata: { phone_number_id: 'phone-1' },
                messages: [{ id: 'wamid.1' }],
                statuses: [{ id: 'wamid.2', status: 'delivered' }],
              },
            },
          ],
        },
      ],
    };
    const id = resolveWebhookEventId(payload, Buffer.from(JSON.stringify(payload)));
    expect(id).toBe(
      'phone-1:message:wamid.1|phone-1:status:wamid.2:delivered',
    );
  });

  it('hashes payload when no granular ids exist', () => {
    const raw = Buffer.from('{"entry":[]}');
    const id = resolveWebhookEventId({ entry: [] }, raw);
    expect(id).toMatch(/^wa_payload_[a-f0-9]{32}$/);
  });
});
