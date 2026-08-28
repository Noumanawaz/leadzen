jest.mock('../../database/prisma.service', () => ({
  PrismaService: class PrismaService {},
}));

jest.mock('../../../generated/prisma/client', () => ({
  PrismaClient: class PrismaClient {},
}));

import { FeatureFlagsService } from './feature-flags.service';

describe('FeatureFlagsService', () => {
  it('prefers org override over global flag', async () => {
    const prisma = {
      featureFlag: {
        findUnique: jest.fn(async () => ({
          id: 'ff1',
          key: 'ai_assist',
          enabled: true,
        })),
      },
      featureFlagOverride: {
        findUnique: jest.fn(async () => ({ enabled: false })),
      },
    };
    const service = new FeatureFlagsService(prisma as never);
    await expect(service.isEnabled('ai_assist', 'org_1')).resolves.toBe(false);
    await expect(service.isEnabled('ai_assist')).resolves.toBe(true);
  });
});
