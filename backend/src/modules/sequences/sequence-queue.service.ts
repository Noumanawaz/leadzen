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
import { SequenceRunnerService } from './sequence-runner.service';

const QUEUE_NAME = 'sequence-steps';

@Injectable()
export class SequenceQueueService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(SequenceQueueService.name);
  private queue: Queue | null = null;
  private worker: Worker | null = null;
  private tickTimer: NodeJS.Timeout | null = null;

  constructor(
    private readonly config: ConfigService<AppEnv, true>,
    private readonly runner: SequenceRunnerService,
  ) {}

  async onModuleInit() {
    const redisUrl = this.config.get('REDIS_URL', { infer: true });
    const redisReady = await this.canConnect(redisUrl);
    if (!redisReady) {
      this.startFallback(
        `Redis unavailable at ${redisUrl} — using in-process sequence ticks`,
      );
      return;
    }

    try {
      const connection = { url: redisUrl, maxRetriesPerRequest: null };
      this.queue = new Queue(QUEUE_NAME, { connection });
      this.worker = new Worker(
        QUEUE_NAME,
        async () => {
          const n = await this.runner.processDue();
          return { processed: n };
        },
        { connection },
      );
      this.worker.on('error', (err) => {
        this.logger.warn(`Sequence worker error: ${err.message}`);
      });
      this.tickTimer = setInterval(() => {
        void this.queue?.add('tick', {}, { removeOnComplete: 100 }).catch((err) => {
          this.logger.warn(
            `Failed to enqueue sequence tick: ${
              err instanceof Error ? err.message : 'unknown'
            }`,
          );
        });
      }, 30_000);
      this.logger.log('Sequence BullMQ worker started');
    } catch (error) {
      this.startFallback(
        `Redis/BullMQ unavailable — using in-process interval. ${
          error instanceof Error ? error.message : ''
        }`,
      );
    }
  }

  async onModuleDestroy() {
    if (this.tickTimer) clearInterval(this.tickTimer);
    await this.worker?.close().catch(() => undefined);
    await this.queue?.close().catch(() => undefined);
  }

  async enqueueNow() {
    const processed = await this.runner.processDue();
    if (this.queue) {
      await this.queue
        .add('tick-now', {}, { removeOnComplete: 100 })
        .catch(() => undefined);
      return { mode: 'bullmq' as const, processed };
    }
    return { mode: 'inline' as const, processed };
  }

  private startFallback(message: string) {
    this.logger.warn(message);
    this.tickTimer = setInterval(() => {
      void this.runner.processDue().catch((err) => {
        this.logger.warn(
          `Fallback sequence tick failed: ${
            err instanceof Error ? err.message : 'unknown'
          }`,
        );
      });
    }, 30_000);
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
      const pong = await client.ping();
      return pong === 'PONG';
    } catch {
      return false;
    } finally {
      client.disconnect();
    }
  }
}
