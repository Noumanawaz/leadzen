import { PlaceholderPhoneProvider, PlaceholderSmsProvider } from './placeholder.providers';

describe('Placeholder communication providers', () => {
  it('sends SMS to valid E.164 numbers', async () => {
    const sms = new PlaceholderSmsProvider();
    const ok = await sms.send({ toE164: '+15551234567', body: 'Hi' });
    expect(ok.status).toBe('sent');
    const bad = await sms.send({ toE164: '555', body: 'Hi' });
    expect(bad.status).toBe('failed');
  });

  it('simulates phone call statuses', async () => {
    const phone = new PlaceholderPhoneProvider();
    const result = await phone.placeCall({ toE164: '+15551234567' });
    expect([
      'completed',
      'no_answer',
      'busy',
      'failed',
      'queued',
      'ringing',
      'in_progress',
    ]).toContain(result.status);
  });
});
