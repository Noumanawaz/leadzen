import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';
import type { AppEnv } from '../../config/env.validation';
import { PrismaService } from '../../database/prisma.service';
import { verifyStripeEvent } from './webhook-signature';

@Injectable()
export class StripeService implements OnModuleInit {
  private readonly logger = new Logger(StripeService.name);
  private stripe: Stripe | null = null;

  constructor(
    private readonly config: ConfigService<AppEnv, true>,
    private readonly prisma: PrismaService,
  ) {}

  onModuleInit() {
    const key = this.config.get('STRIPE_SECRET_KEY', { infer: true });
    if (key) {
      this.stripe = new Stripe(key);
      this.logger.log('Stripe client initialized');
    } else {
      this.logger.warn('STRIPE_SECRET_KEY missing — billing disabled');
    }
  }

  get client(): Stripe {
    if (!this.stripe) {
      throw new Error('Stripe is not configured');
    }
    return this.stripe;
  }

  isConfigured(): boolean {
    return Boolean(this.stripe);
  }

  constructEvent(payload: Buffer, signature: string): Stripe.Event {
    return verifyStripeEvent(
      payload,
      signature,
      this.config.get('STRIPE_WEBHOOK_SECRET', { infer: true }),
      (body, sig, secret) =>
        this.client.webhooks.constructEvent(body, sig, secret),
    );
  }

  /** Dev helper: ensure paid plans exist in Stripe + DB */
  async syncCatalog(): Promise<void> {
    const plans = [
      {
        code: 'starter',
        name: 'Starter',
        amountCents: 2900,
        maxUsers: 10,
        maxLeads: 5000,
        maxStorageBytes: BigInt(5 * 1024 ** 3),
        maxPipelines: 5,
        maxConnectedAccounts: 5,
        includedAiCredits: 2000,
        creditsGranted: 2000,
      },
      {
        code: 'pro',
        name: 'Pro',
        amountCents: 7900,
        maxUsers: 50,
        maxLeads: 50000,
        maxStorageBytes: BigInt(50 * 1024 ** 3),
        maxPipelines: 20,
        maxConnectedAccounts: 20,
        includedAiCredits: 10000,
        creditsGranted: 10000,
      },
      {
        code: 'credits_500',
        name: '500 AI Credits',
        amountCents: 1500,
        maxUsers: 0,
        maxLeads: 0,
        maxStorageBytes: BigInt(0),
        maxPipelines: 0,
        maxConnectedAccounts: 0,
        includedAiCredits: 0,
        creditsGranted: 500,
        interval: 'one_time' as const,
      },
    ];

    for (const plan of plans) {
      const existing = await this.prisma.plan.findUnique({
        where: { code: plan.code },
      });

      let stripeProductId = existing?.stripeProductId ?? null;
      let stripePriceId = existing?.stripePriceId ?? null;

      if (!stripeProductId) {
        const product = await this.client.products.create({
          name: plan.name,
          metadata: { code: plan.code },
        });
        stripeProductId = product.id;
      }

      if (!stripePriceId) {
        const isRecurring = plan.interval !== 'one_time';
        const price = await this.client.prices.create({
          product: stripeProductId,
          unit_amount: plan.amountCents,
          currency: 'usd',
          ...(isRecurring ? { recurring: { interval: 'month' } } : {}),
          metadata: { code: plan.code },
        });
        stripePriceId = price.id;
      }

      await this.prisma.plan.upsert({
        where: { code: plan.code },
        create: {
          code: plan.code,
          name: plan.name,
          amountCents: plan.amountCents,
          maxUsers: plan.maxUsers || 1,
          maxLeads: plan.maxLeads || 1,
          maxStorageBytes: plan.maxStorageBytes || BigInt(1),
          maxPipelines: plan.maxPipelines || 1,
          maxConnectedAccounts: plan.maxConnectedAccounts || 1,
          includedAiCredits: plan.includedAiCredits,
          creditsGranted: plan.creditsGranted,
          interval: plan.interval ?? 'month',
          stripeProductId,
          stripePriceId,
          isActive: true,
        },
        update: {
          name: plan.name,
          amountCents: plan.amountCents,
          creditsGranted: plan.creditsGranted,
          stripeProductId,
          stripePriceId,
          isActive: true,
        },
      });
    }
  }
}
