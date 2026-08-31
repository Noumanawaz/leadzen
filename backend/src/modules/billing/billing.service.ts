import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  CreditTransactionType,
  OrganizationStatus,
  SubscriptionStatus,
} from '../../../generated/prisma/client';
import type { AppEnv } from '../../config/env.validation';
import { PrismaService } from '../../database/prisma.service';
import { AuditService } from '../audit/audit.service';
import { CreditService } from '../credits/credit.service';
import { StripeService } from './stripe.service';

@Injectable()
export class BillingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly stripe: StripeService,
    private readonly credits: CreditService,
    private readonly audit: AuditService,
    private readonly config: ConfigService<AppEnv, true>,
  ) {}

  listPlans() {
    return this.prisma.plan.findMany({
      where: { isActive: true, code: { not: 'trial' } },
      orderBy: { amountCents: 'asc' },
      select: {
        id: true,
        code: true,
        name: true,
        amountCents: true,
        currency: true,
        interval: true,
        creditsGranted: true,
        includedAiCredits: true,
        maxUsers: true,
        maxLeads: true,
        maxPipelines: true,
        maxConnectedAccounts: true,
        stripePriceId: true,
      },
    });
  }

  async getSubscription(organizationId: string) {
    return this.prisma.subscription.findFirst({
      where: { organizationId },
      orderBy: { createdAt: 'desc' },
      include: {
        plan: {
          select: {
            id: true,
            code: true,
            name: true,
            amountCents: true,
            interval: true,
          },
        },
      },
    });
  }

  async ensureStripeCustomer(organizationId: string, email: string) {
    const existing = await this.prisma.stripeCustomer.findUnique({
      where: { organizationId },
    });
    if (existing) return existing;

    const customer = await this.stripe.client.customers.create({
      email,
      metadata: { organizationId },
    });

    return this.prisma.stripeCustomer.create({
      data: {
        organizationId,
        stripeCustomerId: customer.id,
      },
    });
  }

  async createCheckoutSession(params: {
    organizationId: string;
    userId: string;
    email: string;
    planCode: string;
  }) {
    if (!this.stripe.isConfigured()) {
      throw new BadRequestException('Stripe is not configured');
    }

    const plan = await this.prisma.plan.findUnique({
      where: { code: params.planCode },
    });
    if (!plan?.stripePriceId) {
      throw new NotFoundException(
        'Plan not found or not synced to Stripe. Call POST /billing/sync-catalog first.',
      );
    }

    const customer = await this.ensureStripeCustomer(
      params.organizationId,
      params.email,
    );
    const frontend = this.config.get('FRONTEND_URL', { infer: true });
    const isOneTime = plan.interval === 'one_time';

    const session = await this.stripe.client.checkout.sessions.create({
      mode: isOneTime ? 'payment' : 'subscription',
      customer: customer.stripeCustomerId,
      line_items: [{ price: plan.stripePriceId, quantity: 1 }],
      success_url: `${frontend}/settings/billing?checkout=success`,
      cancel_url: `${frontend}/settings/billing?checkout=cancelled`,
      metadata: {
        organizationId: params.organizationId,
        userId: params.userId,
        planCode: plan.code,
        planId: plan.id,
      },
      ...(isOneTime
        ? {}
        : {
            subscription_data: {
              metadata: {
                organizationId: params.organizationId,
                planId: plan.id,
                planCode: plan.code,
              },
            },
          }),
    });

    await this.audit.record({
      action: 'checkout_session_created',
      organizationId: params.organizationId,
      actorUserId: params.userId,
      metadata: { planCode: plan.code, sessionId: session.id },
    });

    return { url: session.url, sessionId: session.id };
  }

  async createPortalSession(organizationId: string) {
    const customer = await this.prisma.stripeCustomer.findUnique({
      where: { organizationId },
    });
    if (!customer) {
      throw new BadRequestException('No billing customer yet');
    }
    const frontend = this.config.get('FRONTEND_URL', { infer: true });
    const session = await this.stripe.client.billingPortal.sessions.create({
      customer: customer.stripeCustomerId,
      return_url: `${frontend}/settings/billing`,
    });
    return { url: session.url };
  }

  async handleWebhook(rawBody: Buffer, signature: string) {
    const event = this.stripe.constructEvent(rawBody, signature);

    const already = await this.prisma.billingEvent.findUnique({
      where: { stripeEventId: event.id },
    });
    if (already?.processedAt) {
      return { received: true, duplicate: true };
    }

    const record = await this.prisma.billingEvent.upsert({
      where: { stripeEventId: event.id },
      create: {
        stripeEventId: event.id,
        type: event.type,
        payload: event as unknown as object,
      },
      update: {},
    });

    try {
      await this.dispatchEvent(event);
      await this.prisma.billingEvent.update({
        where: { id: record.id },
        data: { processedAt: new Date(), error: null },
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Webhook processing failed';
      await this.prisma.billingEvent.update({
        where: { id: record.id },
        data: { error: message },
      });
      throw error;
    }

    return { received: true };
  }

  private async dispatchEvent(event: {
    type: string;
    data: { object: unknown };
  }) {
    switch (event.type) {
      case 'checkout.session.completed':
        await this.onCheckoutCompleted(
          event.data.object as {
            mode?: string;
            subscription?: string | null;
            metadata?: Record<string, string>;
            customer?: string | null;
          },
        );
        break;
      case 'customer.subscription.updated':
      case 'customer.subscription.created':
        await this.onSubscriptionUpserted(
          event.data.object as {
            id: string;
            status: string;
            cancel_at_period_end?: boolean;
            current_period_start?: number;
            current_period_end?: number;
            metadata?: Record<string, string>;
            items?: { data?: Array<{ price?: { id?: string } }> };
          },
        );
        break;
      case 'customer.subscription.deleted':
        await this.onSubscriptionDeleted(
          event.data.object as { id: string; metadata?: Record<string, string> },
        );
        break;
      case 'invoice.payment_failed':
        await this.onPaymentFailed(
          event.data.object as {
            subscription?: string | null;
            customer?: string | null;
          },
        );
        break;
      default:
        break;
    }
  }

  private async onCheckoutCompleted(session: {
    mode?: string;
    subscription?: string | null;
    metadata?: Record<string, string>;
    customer?: string | null;
  }) {
    const organizationId = session.metadata?.organizationId;
    const planId = session.metadata?.planId;
    const planCode = session.metadata?.planCode;
    if (!organizationId || !planId) return;

    await this.prisma.billingEvent.updateMany({
      where: { stripeEventId: { not: '' }, organizationId: null },
      data: {},
    });

    const plan = await this.prisma.plan.findUnique({ where: { id: planId } });
    if (!plan) return;

    if (session.mode === 'payment' || plan.interval === 'one_time') {
      if (plan.creditsGranted > 0) {
        await this.credits.grant({
          organizationId,
          amount: plan.creditsGranted,
          type: CreditTransactionType.purchase,
          reason: `Purchased ${plan.name}`,
          createdByUserId: session.metadata?.userId,
        });
      }
      await this.audit.record({
        action: 'credits_purchased',
        organizationId,
        metadata: { planCode },
      });
      return;
    }

    if (session.subscription) {
      await this.prisma.subscription.upsert({
        where: { stripeSubscriptionId: session.subscription },
        create: {
          organizationId,
          planId,
          stripeSubscriptionId: session.subscription,
          status: SubscriptionStatus.active,
        },
        update: {
          planId,
          status: SubscriptionStatus.active,
        },
      });

      await this.prisma.organization.update({
        where: { id: organizationId },
        data: { planId, status: OrganizationStatus.active },
      });

      if (plan.creditsGranted > 0) {
        await this.credits.grant({
          organizationId,
          amount: plan.creditsGranted,
          type: CreditTransactionType.subscription_grant,
          reason: `${plan.name} subscription credits`,
        });
      }
    }
  }

  private mapStripeStatus(status: string): SubscriptionStatus {
    switch (status) {
      case 'trialing':
        return SubscriptionStatus.trialing;
      case 'active':
        return SubscriptionStatus.active;
      case 'past_due':
        return SubscriptionStatus.past_due;
      case 'canceled':
        return SubscriptionStatus.cancelled;
      case 'unpaid':
        return SubscriptionStatus.unpaid;
      default:
        return SubscriptionStatus.incomplete;
    }
  }

  private async onSubscriptionUpserted(sub: {
    id: string;
    status: string;
    cancel_at_period_end?: boolean;
    current_period_start?: number;
    current_period_end?: number;
    metadata?: Record<string, string>;
  }) {
    const organizationId = sub.metadata?.organizationId;
    const planId = sub.metadata?.planId;
    if (!organizationId || !planId) return;

    const status = this.mapStripeStatus(sub.status);
    await this.prisma.subscription.upsert({
      where: { stripeSubscriptionId: sub.id },
      create: {
        organizationId,
        planId,
        stripeSubscriptionId: sub.id,
        status,
        cancelAtPeriodEnd: sub.cancel_at_period_end ?? false,
        currentPeriodStart: sub.current_period_start
          ? new Date(sub.current_period_start * 1000)
          : null,
        currentPeriodEnd: sub.current_period_end
          ? new Date(sub.current_period_end * 1000)
          : null,
      },
      update: {
        status,
        cancelAtPeriodEnd: sub.cancel_at_period_end ?? false,
        currentPeriodStart: sub.current_period_start
          ? new Date(sub.current_period_start * 1000)
          : null,
        currentPeriodEnd: sub.current_period_end
          ? new Date(sub.current_period_end * 1000)
          : null,
        gracePeriodEndsAt:
          status === SubscriptionStatus.past_due
            ? new Date(
                Date.now() +
                  this.config.get('STRIPE_GRACE_PERIOD_DAYS', { infer: true }) *
                    24 *
                    60 *
                    60 *
                    1000,
              )
            : null,
      },
    });

    const orgStatus =
      status === SubscriptionStatus.active ||
      status === SubscriptionStatus.trialing
        ? OrganizationStatus.active
        : status === SubscriptionStatus.past_due
          ? OrganizationStatus.past_due
          : status === SubscriptionStatus.cancelled
            ? OrganizationStatus.cancelled
            : OrganizationStatus.past_due;

    await this.prisma.organization.update({
      where: { id: organizationId },
      data: {
        status: orgStatus,
        ...(status === SubscriptionStatus.active ||
        status === SubscriptionStatus.trialing
          ? { planId }
          : {}),
      },
    });
  }

  private async onSubscriptionDeleted(sub: {
    id: string;
    metadata?: Record<string, string>;
  }) {
    const existing = await this.prisma.subscription.findUnique({
      where: { stripeSubscriptionId: sub.id },
    });
    if (!existing) return;

    await this.prisma.subscription.update({
      where: { id: existing.id },
      data: { status: SubscriptionStatus.cancelled },
    });

    await this.prisma.organization.update({
      where: { id: existing.organizationId },
      data: { status: OrganizationStatus.cancelled },
    });
  }

  private async onPaymentFailed(invoice: {
    subscription?: string | null;
  }) {
    if (!invoice.subscription) return;
    const sub = await this.prisma.subscription.findUnique({
      where: { stripeSubscriptionId: String(invoice.subscription) },
    });
    if (!sub) return;

    const graceDays = this.config.get('STRIPE_GRACE_PERIOD_DAYS', {
      infer: true,
    });
    await this.prisma.subscription.update({
      where: { id: sub.id },
      data: {
        status: SubscriptionStatus.past_due,
        gracePeriodEndsAt: new Date(
          Date.now() + graceDays * 24 * 60 * 60 * 1000,
        ),
      },
    });
    await this.prisma.organization.update({
      where: { id: sub.organizationId },
      data: { status: OrganizationStatus.past_due },
    });
  }
}
