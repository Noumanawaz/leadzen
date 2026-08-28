jest.mock('../../database/prisma.service', () => ({
  PrismaService: class PrismaService {},
}));

jest.mock('../../../generated/prisma/client', () => ({
  ActivityType: { lead_created: 'lead_created' },
  Prisma: {},
}));

import { LeadsService } from './leads.service';

describe('LeadsService tenant scoping', () => {
  it('lists only within organizationId', async () => {
    const findMany = jest.fn(async () => []);
    const prisma = { lead: { findMany } };
    const service = new LeadsService(prisma as never);
    await service.list('org_a', { search: 'ada' });
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ organizationId: 'org_a' }),
      }),
    );
  });

  it('get requires matching organizationId', async () => {
    const findFirst = jest.fn(async () => null);
    const prisma = { lead: { findFirst } };
    const service = new LeadsService(prisma as never);
    await expect(service.get('org_a', 'lead_1')).rejects.toThrow(
      /Lead not found/,
    );
    expect(findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'lead_1', organizationId: 'org_a', deletedAt: null },
      }),
    );
  });
});
