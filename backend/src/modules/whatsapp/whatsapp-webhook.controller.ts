import {
  BadRequestException,
  Controller,
  ForbiddenException,
  Get,
  Headers,
  Logger,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';
import { WhatsAppWebhookEventStatus } from '../../../generated/prisma/client';
import type { AppEnv } from '../../config/env.validation';
import { verifyMetaWebhookSignature } from './whatsapp-webhook.signature';
import { WhatsAppQueueService } from './whatsapp-queue.service';
import { WhatsAppWebhookService } from './whatsapp-webhook.service';
import { resolveWebhookEventId } from './whatsapp-webhook.utils';

type WebhookPayload = {
  entry?: Array<{ id?: string; changes?: unknown[] }>;
};

@Controller('webhooks/whatsapp')
export class WhatsAppWebhookController {
  private readonly logger = new Logger(WhatsAppWebhookController.name);

  constructor(
    private readonly config: ConfigService<AppEnv, true>,
    private readonly webhook: WhatsAppWebhookService,
    private readonly queue: WhatsAppQueueService,
  ) {}

  @Get()
  verify(
    @Query('hub.mode') mode: string,
    @Query('hub.verify_token') token: string,
    @Query('hub.challenge') challenge: string,
  ) {
    const verifyToken = this.config.get('META_WEBHOOK_VERIFY_TOKEN', {
      infer: true,
    });
    if (mode === 'subscribe' && token === verifyToken) {
      return challenge;
    }
    throw new ForbiddenException('Webhook verification failed');
  }

  @Post()
  async receive(
    @Req() req: Request & { rawBody?: Buffer },
    @Headers('x-hub-signature-256') signature: string | undefined,
  ) {
    const appSecret = this.config.get('META_APP_SECRET', { infer: true });
    if (!req.rawBody || !appSecret) {
      throw new BadRequestException('Invalid webhook payload');
    }
    if (!verifyMetaWebhookSignature(req.rawBody, signature, appSecret)) {
      throw new ForbiddenException('Invalid webhook signature');
    }

    const payload = JSON.parse(req.rawBody.toString('utf8')) as WebhookPayload;
    const externalEventId = resolveWebhookEventId(
      payload as Parameters<typeof resolveWebhookEventId>[0],
      req.rawBody,
    );

    const isNew = await this.webhook.recordWebhookEvent({
      externalEventId,
      eventType: 'whatsapp_notification',
      payload,
    });
    if (!isNew) {
      return { success: true, duplicate: true };
    }

    this.logger.log('whatsapp.webhook.received');
    void this.queue
      .enqueue(externalEventId, payload)
      .catch(() => undefined);
    return { success: true };
  }
}
