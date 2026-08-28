import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  OnModuleDestroy,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';
import IORedis from 'ioredis';
import type { AppEnv } from '../../config/env.validation';

type Bucket = { count: number; resetAt: number };

@Injectable()
export class RateLimitGuard implements CanActivate, OnModuleDestroy {
  private readonly logger = new Logger(RateLimitGuard.name);
  private redis: IORedis | null = null;
  private readonly memory = new Map<string, Bucket>();
  private redisReady = false;

  constructor(private readonly config: ConfigService<AppEnv, true>) {
    if (!process.env.JEST_WORKER_ID) {
      void this.initRedis();
    }
  }

  private async initRedis() {
    const url = this.config.get('REDIS_URL', { infer: true });
    const client = new IORedis(url, {
      maxRetriesPerRequest: 1,
      lazyConnect: true,
      connectTimeout: 800,
      enableOfflineQueue: false,
      retryStrategy: () => null,
    });
    try {
      await Promise.race([
        (async () => {
          await client.connect();
          await client.ping();
        })(),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('redis connect timeout')), 1000),
        ),
      ]);
      this.redis = client;
      this.redisReady = true;
      this.logger.log('Rate limiter using Redis');
    } catch {
      try {
        client.disconnect();
      } catch {
        /* ignore */
      }
      this.redis = null;
      this.redisReady = false;
      this.logger.warn(
        'Rate limiter using in-memory fallback (Redis unavailable)',
      );
    }
  }

  async onModuleDestroy() {
    this.redis?.disconnect();
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<Request>();
    const path = req.path ?? '';
    if (
      path.startsWith('/api/health') ||
      path.includes('/webhooks/') ||
      path.includes('/gmail/callback')
    ) {
      return true;
    }

    const windowMs = this.config.get('RATE_LIMIT_WINDOW_MS', { infer: true });
    const max = this.config.get('RATE_LIMIT_MAX', { infer: true });
    const ip =
      (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
      req.ip ||
      'unknown';
    const key = `rl:${ip}`;

    const count = this.redisReady
      ? await this.incrRedis(key, windowMs)
      : this.incrMemory(key, windowMs);

    if (count > max) {
      throw new HttpException(
        {
          statusCode: HttpStatus.TOO_MANY_REQUESTS,
          message: 'Rate limit exceeded',
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    return true;
  }

  private async incrRedis(key: string, windowMs: number): Promise<number> {
    if (!this.redis) return this.incrMemory(key, windowMs);
    try {
      const count = await this.redis.incr(key);
      if (count === 1) {
        await this.redis.pexpire(key, windowMs);
      }
      return count;
    } catch {
      return this.incrMemory(key, windowMs);
    }
  }

  private incrMemory(key: string, windowMs: number): number {
    const now = Date.now();
    const existing = this.memory.get(key);
    if (!existing || existing.resetAt <= now) {
      this.memory.set(key, { count: 1, resetAt: now + windowMs });
      return 1;
    }
    existing.count += 1;
    return existing.count;
  }
}
