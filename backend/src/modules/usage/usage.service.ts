import { Injectable } from '@nestjs/common';
import {
  Prisma,
  UsageEventType,
} from '../../../generated/prisma/client';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class UsageService {
  constructor(private readonly prisma: PrismaService) {}

  async record(params: {
    organizationId: string;
    type: UsageEventType;
    quantity?: number;
    unit: string;
    provider?: string;
    providerCost?: number;
    metadata?: Prisma.InputJsonValue;
  }) {
    return this.prisma.usageEvent.create({
      data: {
        organizationId: params.organizationId,
        type: params.type,
        quantity: params.quantity ?? 1,
        unit: params.unit,
        provider: params.provider,
        providerCost: params.providerCost,
        metadata: params.metadata,
      },
    });
  }
}
