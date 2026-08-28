import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  CreditTransactionType,
  Prisma,
} from '../../../generated/prisma/client';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class CreditService {
  constructor(private readonly prisma: PrismaService) {}

  async ensureAccount(organizationId: string) {
    return this.prisma.creditAccount.upsert({
      where: { organizationId },
      create: { organizationId, balance: 0 },
      update: {},
    });
  }

  async getBalance(organizationId: string): Promise<number> {
    const account = await this.ensureAccount(organizationId);
    return account.balance;
  }

  async grant(params: {
    organizationId: string;
    amount: number;
    type: CreditTransactionType;
    reason?: string;
    createdByUserId?: string;
    metadata?: Prisma.InputJsonValue;
  }) {
    if (params.amount <= 0) {
      throw new BadRequestException('Grant amount must be positive');
    }
    return this.applyDelta({
      ...params,
      amount: params.amount,
    });
  }

  async debit(params: {
    organizationId: string;
    amount: number;
    reason?: string;
    createdByUserId?: string;
    metadata?: Prisma.InputJsonValue;
  }) {
    if (params.amount <= 0) {
      throw new BadRequestException('Debit amount must be positive');
    }
    return this.applyDelta({
      organizationId: params.organizationId,
      amount: -params.amount,
      type: CreditTransactionType.usage,
      reason: params.reason,
      createdByUserId: params.createdByUserId,
      metadata: params.metadata,
    });
  }

  private async applyDelta(params: {
    organizationId: string;
    amount: number;
    type: CreditTransactionType;
    reason?: string;
    createdByUserId?: string;
    metadata?: Prisma.InputJsonValue;
  }) {
    return this.prisma.$transaction(async (tx) => {
      const account = await tx.creditAccount.upsert({
        where: { organizationId: params.organizationId },
        create: { organizationId: params.organizationId, balance: 0 },
        update: {},
      });

      const locked = await tx.$queryRaw<Array<{ id: string; balance: number }>>`
        SELECT id, balance FROM credit_accounts WHERE id = ${account.id} FOR UPDATE
      `;
      const current = locked[0];
      if (!current) {
        throw new NotFoundException('Credit account not found');
      }

      const nextBalance = current.balance + params.amount;
      if (nextBalance < 0) {
        throw new BadRequestException('Insufficient credits');
      }

      const updated = await tx.creditAccount.update({
        where: { id: account.id },
        data: { balance: nextBalance },
      });

      const transaction = await tx.creditTransaction.create({
        data: {
          organizationId: params.organizationId,
          creditAccountId: account.id,
          type: params.type,
          amount: params.amount,
          balanceAfter: nextBalance,
          reason: params.reason,
          createdByUserId: params.createdByUserId,
          metadata: params.metadata,
        },
      });

      return { account: updated, transaction };
    });
  }
}
