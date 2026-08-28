import {
  assertStripeWebhookInput,
  verifyStripeEvent,
} from './webhook-signature';

describe('Stripe webhook signature gate', () => {
  const payload = Buffer.from('{"id":"evt_1"}');

  it('rejects missing webhook secret', () => {
    expect(() =>
      assertStripeWebhookInput(payload, 'sig', ''),
    ).toThrow(/STRIPE_WEBHOOK_SECRET/);
  });

  it('rejects missing signature', () => {
    expect(() =>
      assertStripeWebhookInput(payload, undefined, 'whsec_test'),
    ).toThrow(/stripe-signature/);
  });

  it('calls verifier when inputs are valid', () => {
    const event = verifyStripeEvent(
      payload,
      't=1,v1=abc',
      'whsec_test',
      () => ({ id: 'evt_1', type: 'checkout.session.completed' }),
    );
    expect(event.id).toBe('evt_1');
  });
});
