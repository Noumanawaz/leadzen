import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import {
  ActivityType,
  ConnectedAccountProvider,
  ConnectedAccountStatus,
  MessageChannel,
  MessageDirection,
  MessageStatus,
  UsageEventType,
} from '../../../generated/prisma/client';
import { toE164 } from '../../common/utils/phone.util';
import { PrismaService } from '../../database/prisma.service';
import { CreditService } from '../credits/credit.service';
import { EntitlementService } from '../entitlements/entitlement.service';
import { GmailOAuthService } from '../email/gmail-oauth.service';
import { UsageService } from '../usage/usage.service';
import { SuppressionsService } from '../suppressions/suppressions.service';
import { MetaWhatsAppProvider } from '../whatsapp/meta-whatsapp.provider';
import { WhatsAppIntegrationService } from '../whatsapp/whatsapp-integration.service';
import { PlaceholderPhoneProvider, PlaceholderSmsProvider } from './placeholder.providers';

@Injectable()
export class OutreachRouter {
  constructor(
    private readonly prisma: PrismaService,
    private readonly gmail: GmailOAuthService,
    private readonly whatsappProvider: MetaWhatsAppProvider,
    private readonly whatsappIntegration: WhatsAppIntegrationService,
    private readonly sms: PlaceholderSmsProvider,
    private readonly phone: PlaceholderPhoneProvider,
    private readonly suppressions: SuppressionsService,
    private readonly credits: CreditService,
    private readonly usage: UsageService,
    private readonly entitlements: EntitlementService,
  ) {}

  listAccounts(organizationId: string) {
    return this.prisma.connectedAccount.findMany({
      where: { organizationId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        provider: true,
        label: true,
        externalAccountId: true,
        status: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  listSendAccounts(organizationId: string) {
    return this.prisma.connectedAccount.findMany({
      where: {
        organizationId,
        status: ConnectedAccountStatus.active,
        provider: {
          in: [
            ConnectedAccountProvider.gmail,
            ConnectedAccountProvider.meta_whatsapp,
          ],
        },
      },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        provider: true,
        label: true,
        status: true,
      },
    });
  }

  async listLeadMessages(organizationId: string, leadId: string) {
    const lead = await this.prisma.lead.findFirst({
      where: { id: leadId, organizationId, deletedAt: null },
      select: { id: true },
    });
    if (!lead) throw new NotFoundException('Lead not found');

    return this.prisma.message.findMany({
      where: { organizationId, leadId },
      orderBy: { createdAt: 'desc' },
      take: 100,
      select: {
        id: true,
        channel: true,
        direction: true,
        status: true,
        subject: true,
        body: true,
        toAddress: true,
        fromAddress: true,
        error: true,
        createdAt: true,
      },
    });
  }

  whatsAppStatus(organizationId: string) {
    return this.whatsappIntegration.getStatus(organizationId);
  }

  getWhatsAppIntegration(organizationId: string) {
    return this.whatsappIntegration.getIntegration(organizationId);
  }

  async disconnect(organizationId: string, accountId: string) {
    const account = await this.prisma.connectedAccount.findFirst({
      where: { id: accountId, organizationId },
    });
    if (!account) throw new NotFoundException('Connected account not found');
    return this.prisma.connectedAccount.update({
      where: { id: accountId },
      data: {
        status: ConnectedAccountStatus.disconnected,
        encryptedCredentials: null,
      },
    });
  }

  async sendEmail(params: {
    organizationId: string;
    userId: string;
    connectedAccountId: string;
    leadId?: string;
    to: string;
    subject: string;
    body: string;
  }) {
    if (await this.suppressions.isEmailSuppressed(params.organizationId, params.to)) {
      throw new BadRequestException('Recipient is on the suppression list');
    }

    const account = await this.prisma.connectedAccount.findFirst({
      where: {
        id: params.connectedAccountId,
        organizationId: params.organizationId,
        provider: ConnectedAccountProvider.gmail,
        status: ConnectedAccountStatus.active,
      },
    });
    if (!account?.encryptedCredentials) {
      throw new NotFoundException('Active Gmail account not found');
    }

    const message = await this.prisma.message.create({
      data: {
        organizationId: params.organizationId,
        connectedAccountId: account.id,
        leadId: params.leadId,
        channel: MessageChannel.email,
        direction: MessageDirection.outbound,
        status: MessageStatus.sending,
        subject: params.subject,
        body: params.body,
        toAddress: params.to,
        fromAddress: account.label,
      },
    });

    try {
      const provider = this.gmail.createEmailProvider(
        account.encryptedCredentials,
      );
      const result = await provider.send({
        to: params.to,
        subject: params.subject,
        bodyText: params.body,
      });

      await this.prisma.message.update({
        where: { id: message.id },
        data: {
          status: MessageStatus.sent,
          providerMessageId: result.providerMessageId,
          threadId: result.threadId,
        },
      });

      await this.usage.record({
        organizationId: params.organizationId,
        type: UsageEventType.email_sent,
        unit: 'message',
        provider: 'gmail',
      });

      if (params.leadId) {
        await this.prisma.activity.create({
          data: {
            organizationId: params.organizationId,
            leadId: params.leadId,
            type: ActivityType.email_sent,
            title: params.subject,
            actorUserId: params.userId,
            metadata: { messageId: message.id },
          },
        });
        await this.prisma.lead.update({
          where: { id: params.leadId },
          data: { lastContactedAt: new Date() },
        });
      }

      return { messageId: message.id, providerMessageId: result.providerMessageId };
    } catch (error) {
      const err = error instanceof Error ? error.message : 'Send failed';
      await this.prisma.message.update({
        where: { id: message.id },
        data: { status: MessageStatus.failed, error: err },
      });
      throw error;
    }
  }

  async sendWhatsApp(params: {
    organizationId: string;
    userId: string;
    leadId?: string;
    toE164: string;
    body: string;
    templateName?: string;
    templateLanguage?: string;
  }) {
    const normalized = toE164(params.toE164);
    if (!normalized) {
      throw new BadRequestException('Invalid phone number — use E.164 format (+923...)');
    }

    if (
      await this.suppressions.isPhoneSuppressed(params.organizationId, normalized)
    ) {
      throw new BadRequestException('Recipient phone is suppressed');
    }

    const { accountId, credentials } =
      await this.whatsappIntegration.resolveCredentials(params.organizationId);

    const message = await this.prisma.message.create({
      data: {
        organizationId: params.organizationId,
        connectedAccountId: accountId,
        leadId: params.leadId,
        channel: MessageChannel.whatsapp,
        direction: MessageDirection.outbound,
        status: MessageStatus.sending,
        body: params.body,
        toAddress: normalized,
      },
    });

    const result = params.templateName
      ? await this.whatsappProvider.sendTemplateMessage(
          {
            toE164: normalized,
            templateName: params.templateName,
            language: params.templateLanguage ?? 'en',
          },
          credentials,
        )
      : await this.whatsappProvider.sendTextMessage(
          { toE164: normalized, body: params.body },
          credentials,
        );

    if (result.status === 'failed' || !result.providerMessageId) {
      if (result.authError) {
        await this.whatsappIntegration.handleSendAuthFailure(
          params.organizationId,
          accountId,
        );
      }
      await this.prisma.message.update({
        where: { id: message.id },
        data: {
          status: MessageStatus.failed,
          error: result.error ?? 'WhatsApp message could not be sent.',
        },
      });
      throw new BadRequestException(
        result.error ?? 'WhatsApp message could not be sent.',
      );
    }

    await this.prisma.message.update({
      where: { id: message.id },
      data: {
        status: MessageStatus.sent,
        providerMessageId: result.providerMessageId,
      },
    });

    await this.usage.record({
      organizationId: params.organizationId,
      type: UsageEventType.whatsapp_message,
      unit: 'message',
      provider: 'meta_whatsapp',
    });
    await this.credits.debit({
      organizationId: params.organizationId,
      amount: 1,
      reason: 'whatsapp_message',
      createdByUserId: params.userId,
    });

    if (params.leadId) {
      await this.prisma.activity.create({
        data: {
          organizationId: params.organizationId,
          leadId: params.leadId,
          type: ActivityType.whatsapp_sent,
          title: 'WhatsApp message',
          actorUserId: params.userId,
          metadata: { messageId: message.id },
        },
      });
      await this.prisma.lead.update({
        where: { id: params.leadId },
        data: { lastContactedAt: new Date() },
      });
    }

    return { messageId: message.id, ...result };
  }

  async sendSms(params: {
    organizationId: string;
    userId: string;
    leadId?: string;
    toE164: string;
    body: string;
  }) {
    const normalized = toE164(params.toE164);
    if (!normalized) {
      throw new BadRequestException('Invalid phone number — use E.164 format (+923...)');
    }

    if (
      await this.suppressions.isPhoneSuppressed(params.organizationId, normalized)
    ) {
      throw new BadRequestException('Recipient phone is suppressed');
    }

    const result = await this.sms.send({ toE164: normalized, body: params.body });
    const message = await this.prisma.message.create({
      data: {
        organizationId: params.organizationId,
        leadId: params.leadId,
        channel: MessageChannel.sms,
        direction: MessageDirection.outbound,
        status:
          result.status === 'sent' ? MessageStatus.sent : MessageStatus.failed,
        body: params.body,
        toAddress: normalized,
        providerMessageId: result.providerMessageId,
        metadata: { simulated: true },
      },
    });

    await this.usage.record({
      organizationId: params.organizationId,
      type: UsageEventType.sms_message,
      unit: 'message',
      provider: 'sms_placeholder',
    });
    await this.credits.debit({
      organizationId: params.organizationId,
      amount: 1,
      reason: 'sms_message',
      createdByUserId: params.userId,
    });

    if (params.leadId) {
      await this.prisma.activity.create({
        data: {
          organizationId: params.organizationId,
          leadId: params.leadId,
          type: ActivityType.sms_sent,
          title: 'SMS sent (placeholder)',
          actorUserId: params.userId,
          metadata: { messageId: message.id, simulated: true },
        },
      });
      await this.prisma.lead.update({
        where: { id: params.leadId },
        data: { lastContactedAt: new Date() },
      });
    }

    return { messageId: message.id, ...result, simulated: true as const };
  }

  async placeCall(params: {
    organizationId: string;
    userId: string;
    leadId?: string;
    toE164: string;
  }) {
    const normalized = toE164(params.toE164);
    if (!normalized) {
      throw new BadRequestException('Invalid phone number — use E.164 format (+923...)');
    }

    const result = await this.phone.placeCall({ toE164: normalized });
    const statusMap: Record<string, MessageStatus> = {
      queued: MessageStatus.queued,
      ringing: MessageStatus.ringing,
      in_progress: MessageStatus.in_progress,
      completed: MessageStatus.completed,
      failed: MessageStatus.failed,
      no_answer: MessageStatus.no_answer,
      busy: MessageStatus.busy,
    };

    const message = await this.prisma.message.create({
      data: {
        organizationId: params.organizationId,
        leadId: params.leadId,
        channel: MessageChannel.phone,
        direction: MessageDirection.outbound,
        status: statusMap[result.status] ?? MessageStatus.failed,
        toAddress: normalized,
        providerMessageId: result.providerCallId,
        metadata: {
          simulatedMinutes: result.simulatedMinutes,
          simulated: true,
        },
      },
    });

    if (result.simulatedMinutes > 0) {
      await this.usage.record({
        organizationId: params.organizationId,
        type: UsageEventType.call_minute,
        quantity: result.simulatedMinutes,
        unit: 'minute',
        provider: 'phone_placeholder',
      });
      await this.credits.debit({
        organizationId: params.organizationId,
        amount: result.simulatedMinutes,
        reason: 'call_minutes',
        createdByUserId: params.userId,
      });
    }

    if (params.leadId) {
      await this.prisma.activity.create({
        data: {
          organizationId: params.organizationId,
          leadId: params.leadId,
          type:
            result.status === 'completed'
              ? ActivityType.call_completed
              : ActivityType.call_failed,
          title: `Call ${result.status} (simulated)`,
          actorUserId: params.userId,
          metadata: { messageId: message.id, status: result.status, simulated: true },
        },
      });
      if (result.status === 'completed') {
        await this.prisma.lead.update({
          where: { id: params.leadId },
          data: { lastContactedAt: new Date() },
        });
      }
    }

    return { messageId: message.id, ...result, simulated: true as const };
  }

  async saveGmailAccount(params: {
    organizationId: string;
    email: string;
    encryptedCredentials: string;
  }) {
    await this.entitlements.assertCanAddConnectedAccount(params.organizationId);

    const existing = await this.prisma.connectedAccount.findFirst({
      where: {
        organizationId: params.organizationId,
        provider: ConnectedAccountProvider.gmail,
        externalAccountId: params.email,
      },
    });

    if (existing) {
      return this.prisma.connectedAccount.update({
        where: { id: existing.id },
        data: {
          encryptedCredentials: params.encryptedCredentials,
          status: ConnectedAccountStatus.active,
          label: params.email,
        },
      });
    }

    return this.prisma.connectedAccount.create({
      data: {
        organizationId: params.organizationId,
        provider: ConnectedAccountProvider.gmail,
        label: params.email,
        externalAccountId: params.email,
        encryptedCredentials: params.encryptedCredentials,
        status: ConnectedAccountStatus.active,
      },
    });
  }
}
