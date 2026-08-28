import { BadRequestException, Injectable } from '@nestjs/common';
import { CreditService } from '../credits/credit.service';
import { PrismaService } from '../../database/prisma.service';
import {
  DEFAULT_FIND_LEADS_COSTS,
  FIND_LEADS_COST_CODES,
  FIND_LEADS_COST_LABELS,
  type FindLeadsCostCode,
} from './credit-cost.constants';

@Injectable()
export class CreditCostService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly credits: CreditService,
  ) {}

  async resolve(code: string): Promise<number> {
    const row = await this.prisma.creditCostConfig.findUnique({
      where: { code },
    });
    if (row) return row.credits;
    return (
      DEFAULT_FIND_LEADS_COSTS[code as FindLeadsCostCode] ?? 0
    );
  }

  async getFindLeadsPricing(organizationId: string) {
    const codes = Object.values(FIND_LEADS_COST_CODES);
    const rows = await this.prisma.creditCostConfig.findMany({
      where: { code: { in: codes } },
    });
    const byCode = new Map(rows.map((r) => [r.code, r]));

    const costs = codes.map((code) => ({
      code,
      label: FIND_LEADS_COST_LABELS[code],
      credits:
        byCode.get(code)?.credits ?? DEFAULT_FIND_LEADS_COSTS[code],
      description: byCode.get(code)?.description ?? null,
    }));

    const balance = await this.credits.getBalance(organizationId);

    return { balance, costs };
  }

  async debitOperation(params: {
    organizationId: string;
    code: FindLeadsCostCode;
    quantity?: number;
    actorUserId?: string;
    metadata?: Record<string, unknown>;
  }): Promise<number> {
    const unitCost = await this.resolve(params.code);
    const quantity = params.quantity ?? 1;
    const amount = unitCost * quantity;
    if (amount <= 0) return 0;

    const balance = await this.credits.getBalance(params.organizationId);
    if (balance < amount) {
      throw new BadRequestException(
        `Insufficient platform credits. Need ${amount}, balance is ${balance}.`,
      );
    }

    await this.credits.debit({
      organizationId: params.organizationId,
      amount,
      reason: params.code,
      createdByUserId: params.actorUserId,
      metadata: {
        costCode: params.code,
        quantity,
        unitCost,
        ...params.metadata,
      },
    });

    return amount;
  }
}
