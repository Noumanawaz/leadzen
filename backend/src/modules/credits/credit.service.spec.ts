jest.mock('../../database/prisma.service', () => ({
  PrismaService: class PrismaService {},
}));

jest.mock('../../../generated/prisma/client', () => ({
  CreditTransactionType: {
    subscription_grant: 'subscription_grant',
    usage: 'usage',
    purchase: 'purchase',
    refund: 'refund',
    adjustment: 'adjustment',
    expiration: 'expiration',
  },
  PrismaClient: class PrismaClient {},
}));

import { CreditService } from './credit.service';

describe('CreditService', () => {
  const organizationId = 'org_test';

  function createService(initialBalance = 100) {
    let balance = initialBalance;
    const account = { id: 'acc_1', organizationId, balance };

    const tx = {
      creditAccount: {
        upsert: jest.fn(async () => ({ ...account, balance })),
        update: jest.fn(async ({ data }: { data: { balance: number } }) => {
          balance = data.balance;
          return { ...account, balance };
        }),
      },
      creditTransaction: {
        create: jest.fn(async ({ data }: { data: { amount: number } }) => data),
      },
      $queryRaw: jest.fn(async () => [{ id: account.id, balance }]),
    };

    const prisma = {
      creditAccount: {
        upsert: jest.fn(async () => ({ ...account, balance })),
      },
      $transaction: jest.fn(async (fn: (t: typeof tx) => Promise<unknown>) =>
        fn(tx),
      ),
    };

    return {
      service: new CreditService(prisma as never),
      getBalance: () => balance,
    };
  }

  it('grants credits and records a transaction', async () => {
    const { service, getBalance } = createService(0);
    const result = await service.grant({
      organizationId,
      amount: 50,
      type: 'subscription_grant' as never,
      reason: 'trial',
    });
    expect(getBalance()).toBe(50);
    expect(result.transaction.amount).toBe(50);
  });

  it('debits credits atomically', async () => {
    const { service, getBalance } = createService(100);
    await service.debit({ organizationId, amount: 40, reason: 'ai' });
    expect(getBalance()).toBe(60);
  });

  it('rejects insufficient balance', async () => {
    const { service } = createService(10);
    await expect(
      service.debit({ organizationId, amount: 20, reason: 'ai' }),
    ).rejects.toThrow(/Insufficient credits/);
  });
});
