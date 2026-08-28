/**
 * Pure helper tested without Stripe network — mirrors Stripe signature gate.
 */
export function assertStripeWebhookInput(
  payload: Buffer | undefined,
  signature: string | undefined,
  secret: string | undefined,
): void {
  if (!secret) {
    throw new Error('STRIPE_WEBHOOK_SECRET is not configured');
  }
  if (!signature) {
    throw new Error('Missing stripe-signature header');
  }
  if (!payload?.length) {
    throw new Error('Raw body missing for Stripe webhook');
  }
}

export function verifyStripeEvent<T>(
  payload: Buffer,
  signature: string,
  secret: string,
  verifier: (payload: Buffer, signature: string, secret: string) => T,
): T {
  assertStripeWebhookInput(payload, signature, secret);
  return verifier(payload, signature, secret);
}
