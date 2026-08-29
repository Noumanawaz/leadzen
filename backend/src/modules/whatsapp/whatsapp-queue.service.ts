import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Queue, Worker } from 'bullmq';
import IORedis from 'ioredis';
import { WhatsAppWebhookEventStatus } from '../../../generated/prisma/client';
import type { AppEnv } from '../../config/env.validation';
import { WhatsAppIntegrationService } from './whatsapp-integration.service';
import { WhatsAppWebhookService } from './whatsapp-webhook.service';

const QUEUE_NAME = 'whatsapp-webhooks';

@Injectable()
export class WhatsAppQueueService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(WhatsAppQueueService.name);
  private queue: Queue | null = null;
  private worker: Worker | null = null;

  constructor(
    private readonly config: ConfigService<AppEnv, true>,
    private readonly webhook: WhatsAppWebhookService,
    private readonly integration: WhatsAppIntegrationService,
  ) {}

  async onModuleInit() {
    const redisUrl = this.config.get('REDIS_URL', { infer: true });
    const redisReady = await this.canConnect(redisUrl);
    if (!redisReady) {
      this.logger.warn(
        `Redis unavailable — WhatsApp webhooks processed inline`,
      );
      return;
    }

    try {
      const connection = { url: redisUrl, maxRetriesPerRequest: null };
      this.queue = new Queue(QUEUE_NAME, { connection });
      this.worker = new Worker(
        QUEUE_NAME,
        async (job) => {
          const { externalEventId, payload } = job.data as {
            externalEventId: string;
            payload: unknown;
          };
          try {
            const typedPayload = payload as Parameters<
              WhatsAppWebhookService['processPayload']
            >[0];
            const phoneNumberId =
              this.webhook.extractPhoneNumberId(typedPayload);
            if (phoneNumberId) {
              const account =
                await this.integration.findAccountByPhoneNumberId(
                  phoneNumberId,
                );
              await this.webhook.enrichWebhookEventContext(externalEventId, {
                phoneNumberId,
                organizationId: account?.organizationId,
              });
            }
            await this.webhook.processPayload(typedPayload);
            await this.webhook.markEventProcessed(
              externalEventId,
              WhatsAppWebhookEventStatus.processed,
            );
          } catch (err) {
            await this.webhook.markEventProcessed(
              externalEventId,
              WhatsAppWebhookEventStatus.failed,
            );
            throw err;
          }
        },
        { connection },
      );
      this.worker.on('error', (err) => {
        this.logger.warn(`WhatsApp worker error: ${err.message}`);
      });
      this.logger.log('WhatsApp webhook BullMQ worker started');
    } catch (error) {
      this.logger.warn(
        `WhatsApp queue unavailable — inline processing only. ${
          error instanceof Error ? error.message : ''
        }`,
      );
    }
  }

  async onModuleDestroy() {
    await this.worker?.close().catch(() => undefined);
    await this.queue?.close().catch(() => undefined);
  }

  async enqueue(externalEventId: string, payload: unknown) {
    const typedPayload = payload as Parameters<
      WhatsAppWebhookService['processPayload']
    >[0];

    if (this.queue) {
      await this.queue.add(
        'event',
        { externalEventId, payload },
        {
          removeOnComplete: 200,
          attempts: 3,
          backoff: { type: 'exponential', delay: 2000 },
        },
      );
      return;
    }

    const phoneNumberId = this.webhook.extractPhoneNumberId(typedPayload);
    if (phoneNumberId) {
      const account =
        await this.integration.findAccountByPhoneNumberId(phoneNumberId);
      await this.webhook.enrichWebhookEventContext(externalEventId, {
        phoneNumberId,
        organizationId: account?.organizationId,
      });
    }
    await this.webhook.processPayload(typedPayload);
    await this.webhook.markEventProcessed(
      externalEventId,
      WhatsAppWebhookEventStatus.processed,
    );
  }

  private async canConnect(redisUrl: string): Promise<boolean> {
    const client = new IORedis(redisUrl, {
      maxRetriesPerRequest: 1,
      connectTimeout: 2000,
      lazyConnect: true,
    });
    try {
      await client.connect();
      await client.ping();
      return true;
    } catch {
      return false;
    } finally {
      client.disconnect();
    }
  }
}
