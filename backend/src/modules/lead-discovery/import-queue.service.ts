import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Queue, Worker } from 'bullmq';
import IORedis from 'ioredis';
import type { AppEnv } from '../../config/env.validation';
import { LeadImportService } from './lead-import.service';

const QUEUE_NAME = 'lead-imports';

@Injectable()
export class ImportQueueService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ImportQueueService.name);
  private queue: Queue | null = null;
  private worker: Worker | null = null;
  private inline = true;

  constructor(
    private readonly config: ConfigService<AppEnv, true>,
    private readonly imports: LeadImportService,
  ) {}

  async onModuleInit() {
    const redisUrl = this.config.get('REDIS_URL', { infer: true });
    const ready = await this.canConnect(redisUrl);
    if (!ready) {
      this.logger.warn(
        `Redis unavailable at ${redisUrl} — CSV imports run inline`,
      );
      return;
    }
    try {
      const connection = { url: redisUrl, maxRetriesPerRequest: null };
      this.queue = new Queue(QUEUE_NAME, { connection });
      this.worker = new Worker(
        QUEUE_NAME,
        async (job) => {
          await this.imports.processJob(String(job.data.importId));
        },
        { connection },
      );
      this.worker.on('error', (err) => {
        this.logger.warn(`Import worker error: ${err.message}`);
      });
      this.inline = false;
      this.logger.log('Lead-imports BullMQ worker started');
    } catch (error) {
      this.logger.warn(
        `BullMQ import queue unavailable — inline mode. ${
          error instanceof Error ? error.message : ''
        }`,
      );
    }
  }

  async onModuleDestroy() {
    await this.worker?.close().catch(() => undefined);
    await this.queue?.close().catch(() => undefined);
  }

  async enqueue(importId: string) {
    if (this.queue && !this.inline) {
      await this.queue.add(
        'process',
        { importId },
        { removeOnComplete: 100, removeOnFail: 50 },
      );
      return { mode: 'bullmq' as const };
    }
    await this.imports.processJob(importId);
    return { mode: 'inline' as const };
  }

  private async canConnect(redisUrl: string): Promise<boolean> {
    const client = new IORedis(redisUrl, {
      maxRetriesPerRequest: 1,
      enableReadyCheck: true,
      connectTimeout: 1500,
      lazyConnect: true,
      retryStrategy: () => null,
    });
    try {
      await client.connect();
      return (await client.ping()) === 'PONG';
    } catch {
      return false;
    } finally {
      client.disconnect();
    }
  }
}
