import { HttpException } from '@nestjs/common';
import { RateLimitGuard } from './rate-limit.guard';

describe('RateLimitGuard', () => {
  function createGuard(max = 3, windowMs = 60_000) {
    const config = {
      get: (key: string) => {
        if (key === 'REDIS_URL') return 'redis://localhost:6379';
        if (key === 'RATE_LIMIT_MAX') return max;
        if (key === 'RATE_LIMIT_WINDOW_MS') return windowMs;
        return undefined;
      },
    };
    const guard = new RateLimitGuard(config as never);
    // Force memory path for unit tests
    (guard as unknown as { redisReady: boolean }).redisReady = false;
    return guard;
  }

  function ctx(path = '/api/v1/leads', ip = '1.2.3.4') {
    return {
      switchToHttp: () => ({
        getRequest: () => ({
          path,
          ip,
          headers: {},
        }),
      }),
    } as never;
  }

  it('allows requests under the limit', async () => {
    const guard = createGuard(3);
    await expect(guard.canActivate(ctx())).resolves.toBe(true);
    await expect(guard.canActivate(ctx())).resolves.toBe(true);
  });

  it('blocks when limit exceeded', async () => {
    const guard = createGuard(2);
    await guard.canActivate(ctx('/api/v1/ai', '9.9.9.9'));
    await guard.canActivate(ctx('/api/v1/ai', '9.9.9.9'));
    await expect(guard.canActivate(ctx('/api/v1/ai', '9.9.9.9'))).rejects.toBeInstanceOf(
      HttpException,
    );
  });

  it('skips health endpoints', async () => {
    const guard = createGuard(1);
    await expect(guard.canActivate(ctx('/api/health'))).resolves.toBe(true);
    await expect(guard.canActivate(ctx('/api/health'))).resolves.toBe(true);
  });
});
