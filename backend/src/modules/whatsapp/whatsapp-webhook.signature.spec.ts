import { createHmac } from 'crypto';
import { verifyMetaWebhookSignature } from './whatsapp-webhook.signature';

describe('verifyMetaWebhookSignature', () => {
  const secret = 'test-app-secret';
  const body = Buffer.from('{"object":"whatsapp_business_account"}');

  it('accepts valid signatures', () => {
    const signature =
      'sha256=' + createHmac('sha256', secret).update(body).digest('hex');
    expect(verifyMetaWebhookSignature(body, signature, secret)).toBe(true);
  });

  it('rejects invalid signatures', () => {
    expect(
      verifyMetaWebhookSignature(body, 'sha256=deadbeef', secret),
    ).toBe(false);
  });

  it('rejects missing signature', () => {
    expect(verifyMetaWebhookSignature(body, undefined, secret)).toBe(false);
  });
});
