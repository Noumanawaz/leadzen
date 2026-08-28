jest.mock('../../database/prisma.service', () => ({
  PrismaService: class PrismaService {},
}));

jest.mock('../../../generated/prisma/client', () => ({
  CreditTransactionType: {
    usage: 'usage',
    subscription_grant: 'subscription_grant',
    adjustment: 'adjustment',
  },
  PrismaClient: class PrismaClient {},
}));

import { CreditService } from '../credits/credit.service';

describe('Credit concurrency regression', () => {
  it('serializes debits so balance never goes negative under contention', async () => {
    let balance = 50;
    const account = { id: 'acc_1', organizationId: 'org_1', balance };

    const tx = {
      creditAccount: {
        upsert: jest.fn(async () => ({ ...account, balance })),
        update: jest.fn(async ({ data }: { data: { balance: number } }) => {
          balance = data.balance;
          return { ...account, balance };
        }),
      },
      creditTransaction: {
        create: jest.fn(async ({ data }: { data: unknown }) => data),
      },
      $queryRaw: jest.fn(async () => {
        // Simulate row lock snapshot at call time
        return [{ id: account.id, balance }];
      }),
    };

    // Serialize $transaction callbacks to mimic FOR UPDATE behavior
    let chain = Promise.resolve();
    const prisma = {
      creditAccount: {
        upsert: jest.fn(async () => ({ ...account, balance })),
      },
      $transaction: jest.fn((fn: (t: typeof tx) => Promise<unknown>) => {
        const run = chain.then(() => fn(tx));
        chain = run.then(
          () => undefined,
          () => undefined,
        );
        return run;
      }),
    };

    const service = new CreditService(prisma as never);
    const results = await Promise.allSettled([
      service.debit({ organizationId: 'org_1', amount: 40, reason: 'a' }),
      service.debit({ organizationId: 'org_1', amount: 40, reason: 'b' }),
    ]);

    const fulfilled = results.filter((r) => r.status === 'fulfilled');
    const rejected = results.filter((r) => r.status === 'rejected');
    expect(fulfilled.length).toBe(1);
    expect(rejected.length).toBe(1);
    expect(balance).toBe(10);
  });
});
