jest.mock('../../database/prisma.service', () => ({
  PrismaService: class PrismaService {},
}));

import { SuppressionsService } from './suppressions.service';

describe('SuppressionsService', () => {
  it('checks email suppression case-insensitively', async () => {
    const findFirst = jest.fn(async () => ({ id: '1' }));
    const service = new SuppressionsService({
      suppression: { findFirst },
    } as never);
    await expect(
      service.isEmailSuppressed('org_1', 'Ada@Example.com'),
    ).resolves.toBe(true);
    expect(findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          organizationId: 'org_1',
          email: { equals: 'ada@example.com', mode: 'insensitive' },
        }),
      }),
    );
  });
});
