import { Test, TestingModule } from '@nestjs/testing';
import { HealthController } from './health.controller';
import { HealthService } from './health.service';

jest.mock('../../database/prisma.service', () => ({
  PrismaService: class PrismaService {},
}));

describe('HealthController', () => {
  let controller: HealthController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [
        {
          provide: HealthService,
          useValue: {
            live: () => ({
              status: 'ok',
              service: 'lead-saas-api',
              timestamp: '2026-01-01T00:00:00.000Z',
            }),
            ready: async () => ({
              status: 'ok',
              checks: { database: true },
              timestamp: '2026-01-01T00:00:00.000Z',
            }),
          },
        },
      ],
    }).compile();

    controller = module.get(HealthController);
  });

  it('returns live status', () => {
    expect(controller.live().status).toBe('ok');
  });

  it('returns ready status', async () => {
    await expect(controller.ready()).resolves.toMatchObject({
      status: 'ok',
      checks: { database: true },
    });
  });
});
