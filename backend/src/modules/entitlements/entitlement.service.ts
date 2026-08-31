import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

export type EntitlementLimits = {
  maxUsers: number;
  maxLeads: number;
  maxStorageBytes: bigint;
  maxPipelines: number;
  maxConnectedAccounts: number;
  includedAiCredits: number;
};

@Injectable()
export class EntitlementService {
  constructor(private readonly prisma: PrismaService) {}

  async getLimits(organizationId: string): Promise<EntitlementLimits> {
    const org = await this.prisma.organization.findUnique({
      where: { id: organizationId },
      include: { plan: true },
    });
    if (!org) {
      throw new NotFoundException('Organization not found');
    }
    if (!org.plan) {
      throw new ForbiddenException('Organization has no plan');
    }
    return {
      maxUsers: org.plan.maxUsers,
      maxLeads: org.plan.maxLeads,
      maxStorageBytes: org.plan.maxStorageBytes,
      maxPipelines: org.plan.maxPipelines,
      maxConnectedAccounts: org.plan.maxConnectedAccounts,
      includedAiCredits: org.plan.includedAiCredits,
    };
  }

  async assertCanAddMember(organizationId: string): Promise<void> {
    const limits = await this.getLimits(organizationId);
    const count = await this.prisma.membership.count({
      where: {
        organizationId,
        status: { in: ['active', 'invited'] },
      },
    });
    if (count >= limits.maxUsers) {
      throw new ForbiddenException('Plan user limit reached');
    }
  }

  async assertCanAddConnectedAccount(organizationId: string): Promise<void> {
    const limits = await this.getLimits(organizationId);
    const count = await this.prisma.connectedAccount.count({
      where: {
        organizationId,
        status: { not: 'disconnected' },
      },
    });
    if (count >= limits.maxConnectedAccounts) {
      throw new ForbiddenException('Plan connected account limit reached');
    }
  }
}
