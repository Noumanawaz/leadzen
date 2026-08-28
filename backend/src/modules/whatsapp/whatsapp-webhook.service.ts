import { Injectable, Logger } from '@nestjs/common';
import {
  ActivityType,
  MessageChannel,
  MessageDirection,
  MessageStatus,
  WhatsAppWebhookEventStatus,
} from '../../../generated/prisma/client';
import { toE164 } from '../../common/utils/phone.util';
import { PrismaService } from '../../database/prisma.service';
import { WhatsAppIntegrationService } from './whatsapp-integration.service';

type WebhookPayload = {
  object?: string;
  entry?: Array<{
    id?: string;
    changes?: Array<{
      field?: string;
      value?: {
        messaging_product?: string;
        metadata?: { phone_number_id?: string; display_phone_number?: string };
        contacts?: Array<{ profile?: { name?: string }; wa_id?: string }>;
        messages?: Array<{
          id: string;
          from: string;
          timestamp: string;
          type: string;
          text?: { body?: string };
        }>;
        statuses?: Array<{
          id: string;
          status: string;
          timestamp: string;
          recipient_id: string;
          errors?: Array<{ code?: number; title?: string }>;
        }>;
      };
    }>;
  }>;
};

@Injectable()
export class WhatsAppWebhookService {
  private readonly logger = new Logger(WhatsAppWebhookService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly integration: WhatsAppIntegrationService,
  ) {}

  async processPayload(payload: WebhookPayload) {
    if (payload.object !== 'whatsapp_business_account') {
      return;
    }

    for (const entry of payload.entry ?? []) {
      for (const change of entry.changes ?? []) {
        const value = change.value;
        if (!value) continue;
        const phoneNumberId = value.metadata?.phone_number_id;
        if (!phoneNumberId) continue;

        const account =
          await this.integration.findAccountByPhoneNumberId(phoneNumberId);
        if (!account) {
          this.logger.warn(
            `whatsapp.webhook.ignored unknown phoneNumberId=${phoneNumberId}`,
          );
          continue;
        }

        for (const msg of value.messages ?? []) {
          await this.handleInboundMessage({
            organizationId: account.organizationId,
            connectedAccountId: account.id,
            phoneNumberId,
            waMessageId: msg.id,
            from: msg.from,
            body: msg.text?.body ?? `[${msg.type}]`,
            timestamp: msg.timestamp,
          });
        }

        for (const status of value.statuses ?? []) {
          await this.handleStatusUpdate({
            organizationId: account.organizationId,
            waMessageId: status.id,
            status: status.status,
            errors: status.errors,
          });
        }
      }
    }
  }

  private async handleInboundMessage(params: {
    organizationId: string;
    connectedAccountId: string;
    phoneNumberId: string;
    waMessageId: string;
    from: string;
    body: string;
    timestamp: string;
  }) {
    const existing = await this.prisma.message.findFirst({
      where: {
        organizationId: params.organizationId,
        providerMessageId: params.waMessageId,
      },
    });
    if (existing) return;

    const fromE164 = toE164(`+${params.from}`) ?? `+${params.from}`;
    const lead = await this.prisma.lead.findFirst({
      where: {
        organizationId: params.organizationId,
        deletedAt: null,
        OR: [{ phone: fromE164 }, { phone: params.from }],
      },
      orderBy: { updatedAt: 'desc' },
    });

    const message = await this.prisma.message.create({
      data: {
        organizationId: params.organizationId,
        connectedAccountId: params.connectedAccountId,
        leadId: lead?.id,
        channel: MessageChannel.whatsapp,
        direction: MessageDirection.inbound,
        status: MessageStatus.replied,
        body: params.body,
        fromAddress: fromE164,
        toAddress: params.phoneNumberId,
        providerMessageId: params.waMessageId,
        metadata: { waTimestamp: params.timestamp },
      },
    });

    if (lead) {
      await this.prisma.activity.create({
        data: {
          organizationId: params.organizationId,
          leadId: lead.id,
          type: ActivityType.whatsapp_received,
          title: 'WhatsApp reply received',
          metadata: { messageId: message.id, waMessageId: params.waMessageId },
        },
      });
      await this.prisma.lead.update({
        where: { id: lead.id },
        data: { lastContactedAt: new Date() },
      });
    }

    this.logger.log(
      `whatsapp.webhook.processed inbound tenantId=${params.organizationId} waMessageId=${params.waMessageId}`,
    );
  }

  private async handleStatusUpdate(params: {
    organizationId: string;
    waMessageId: string;
    status: string;
    errors?: Array<{ code?: number; title?: string }>;
  }) {
    const message = await this.prisma.message.findFirst({
      where: {
        organizationId: params.organizationId,
        providerMessageId: params.waMessageId,
      },
    });
    if (!message) return;

    const statusMap: Record<string, MessageStatus> = {
      sent: MessageStatus.sent,
      delivered: MessageStatus.delivered,
      read: MessageStatus.opened,
      failed: MessageStatus.failed,
    };
    const next = statusMap[params.status] ?? message.status;
    const error =
      params.status === 'failed'
        ? params.errors?.[0]?.title ?? 'Delivery failed'
        : undefined;

    await this.prisma.message.update({
      where: { id: message.id },
      data: { status: next, error: error ?? message.error },
    });
  }

  async recordWebhookEvent(params: {
    externalEventId: string;
    phoneNumberId?: string;
    organizationId?: string;
    eventType: string;
    payload: unknown;
  }): Promise<boolean> {
    try {
      await this.prisma.whatsAppWebhookEvent.create({
        data: {
          externalEventId: params.externalEventId,
          phoneNumberId: params.phoneNumberId,
          organizationId: params.organizationId,
          eventType: params.eventType,
          payload: params.payload as object,
          status: WhatsAppWebhookEventStatus.pending,
        },
      });
      return true;
    } catch {
      return false;
    }
  }

  async markEventProcessed(externalEventId: string, status: WhatsAppWebhookEventStatus) {
    await this.prisma.whatsAppWebhookEvent.updateMany({
      where: { externalEventId },
      data: { status, processedAt: new Date() },
    });
  }
}
