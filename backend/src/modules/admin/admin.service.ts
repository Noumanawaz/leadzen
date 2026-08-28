import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import {
  CreditTransactionType,
  OrganizationStatus,
  Prisma,
} from '../../../generated/prisma/client';
import type { AppEnv } from '../../config/env.validation';
import { PrismaService } from '../../database/prisma.service';
import { AuditService } from '../audit/audit.service';
import { CreditService } from '../credits/credit.service';

@Injectable()
export class AdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly credits: CreditService,
    private readonly audit: AuditService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService<AppEnv, true>,
  ) {}

  async dashboard() {
    const [
      organizations,
      users,
      leads,
      subscriptions,
      activeSubscriptions,
      creditBalance,
      aiRequests,
      aiCost,
      messages,
      auditLogs,
    ] = await Promise.all([
      this.prisma.organization.count({ where: { deletedAt: null } }),
      this.prisma.user.count({ where: { deletedAt: null } }),
      this.prisma.lead.count({ where: { deletedAt: null } }),
      this.prisma.subscription.count(),
      this.prisma.subscription.count({
        where: { status: { in: ['active', 'trialing'] } },
      }),
      this.prisma.creditAccount.aggregate({ _sum: { balance: true } }),
      this.prisma.aiRequest.count(),
      this.prisma.aiRequest.aggregate({ _sum: { providerCost: true } }),
      this.prisma.message.count(),
      this.prisma.auditLog.count(),
    ]);

    const recentOrgs = await this.prisma.organization.findMany({
      where: { deletedAt: null },
      orderBy: { createdAt: 'desc' },
      take: 5,
      select: {
        id: true,
        name: true,
        slug: true,
        status: true,
        createdAt: true,
        plan: { select: { name: true, code: true } },
      },
    });

    return {
      totals: {
        organizations,
        users,
        leads,
        subscriptions,
        activeSubscriptions,
        creditBalance: creditBalance._sum.balance ?? 0,
        aiRequests,
        aiProviderCost: Number(aiCost._sum.providerCost ?? 0),
        messages,
        auditLogs,
      },
      recentOrganizations: recentOrgs,
      generatedAt: new Date().toISOString(),
    };
  }

  listOrganizations(query?: { search?: string; status?: string }) {
    const where: Prisma.OrganizationWhereInput = {
      deletedAt: null,
      ...(query?.status
        ? { status: query.status as OrganizationStatus }
        : {}),
      ...(query?.search
        ? {
            OR: [
              { name: { contains: query.search, mode: 'insensitive' } },
              { slug: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    return this.prisma.organization.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 100,
      include: {
        plan: { select: { id: true, name: true, code: true } },
        creditAccount: { select: { balance: true } },
        _count: {
          select: {
            memberships: true,
            leads: true,
            subscriptions: true,
          },
        },
      },
    });
  }

  async getOrganization(id: string) {
    const org = await this.prisma.organization.findFirst({
      where: { id, deletedAt: null },
      include: {
        plan: true,
        creditAccount: true,
        memberships: {
          include: {
            user: {
              select: {
                id: true,
                email: true,
                firstName: true,
                lastName: true,
                status: true,
              },
            },
          },
        },
        subscriptions: {
          orderBy: { createdAt: 'desc' },
          take: 10,
        },
      },
    });
    if (!org) throw new NotFoundException('Organization not found');
    return org;
  }

  async updateOrganizationStatus(params: {
    organizationId: string;
    status: OrganizationStatus;
    platformAdminId: string;
    actorUserId: string;
  }) {
    const org = await this.prisma.organization.update({
      where: { id: params.organizationId },
      data: { status: params.status },
    });
    await this.audit.record({
      action: 'admin.organization.status_update',
      organizationId: org.id,
      actorUserId: params.actorUserId,
      platformAdminId: params.platformAdminId,
      targetType: 'organization',
      targetId: org.id,
      metadata: { status: params.status },
    });
    return org;
  }

  listUsers(query?: { search?: string }) {
    return this.prisma.user.findMany({
      where: {
        deletedAt: null,
        ...(query?.search
          ? {
              OR: [
                { email: { contains: query.search, mode: 'insensitive' } },
                { firstName: { contains: query.search, mode: 'insensitive' } },
                { lastName: { contains: query.search, mode: 'insensitive' } },
              ],
            }
          : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        status: true,
        createdAt: true,
        lastLoginAt: true,
        memberships: {
          select: {
            role: true,
            status: true,
            organization: { select: { id: true, name: true, slug: true } },
          },
        },
        platformAdmins: {
          select: { id: true, status: true },
        },
      },
    });
  }

  listSubscriptions() {
    return this.prisma.subscription.findMany({
      orderBy: { createdAt: 'desc' },
      take: 100,
      include: {
        organization: { select: { id: true, name: true, slug: true } },
        plan: { select: { id: true, name: true, code: true, amountCents: true } },
      },
    });
  }

  listUsage(take = 50) {
    return this.prisma.usageEvent.findMany({
      orderBy: { createdAt: 'desc' },
      take,
      include: {
        organization: { select: { id: true, name: true } },
      },
    });
  }

  listAiRequests(take = 50) {
    return this.prisma.aiRequest.findMany({
      orderBy: { createdAt: 'desc' },
      take,
      select: {
        id: true,
        organizationId: true,
        feature: true,
        provider: true,
        model: true,
        inputTokens: true,
        outputTokens: true,
        providerCost: true,
        creditsUsed: true,
        createdAt: true,
        organization: { select: { name: true } },
      },
    });
  }

  listAuditLogs(take = 100) {
    return this.prisma.auditLog.findMany({
      orderBy: { createdAt: 'desc' },
      take,
    });
  }

  async adjustCredits(params: {
    organizationId: string;
    amount: number;
    reason: string;
    platformAdminId: string;
    actorUserId: string;
  }) {
    if (params.amount === 0) {
      throw new BadRequestException('Amount must be non-zero');
    }

    const result =
      params.amount > 0
        ? await this.credits.grant({
            organizationId: params.organizationId,
            amount: params.amount,
            type: CreditTransactionType.adjustment,
            reason: params.reason,
            createdByUserId: params.actorUserId,
            metadata: { platformAdminId: params.platformAdminId },
          })
        : await this.credits.debit({
            organizationId: params.organizationId,
            amount: Math.abs(params.amount),
            reason: params.reason,
            createdByUserId: params.actorUserId,
            metadata: {
              platformAdminId: params.platformAdminId,
              type: 'admin_adjustment',
            },
          });

    await this.audit.record({
      action: 'admin.credits.adjust',
      organizationId: params.organizationId,
      actorUserId: params.actorUserId,
      platformAdminId: params.platformAdminId,
      targetType: 'credit_account',
      targetId: result.account.id,
      metadata: {
        amount: params.amount,
        reason: params.reason,
        balanceAfter: result.account.balance,
      },
    });

    return {
      balance: result.account.balance,
      transactionId: result.transaction.id,
    };
  }

  async search(q: string) {
    const term = q.trim();
    if (!term) {
      return { organizations: [], users: [], leads: [] };
    }

    const [organizations, users, leads] = await Promise.all([
      this.prisma.organization.findMany({
        where: {
          deletedAt: null,
          OR: [
            { name: { contains: term, mode: 'insensitive' } },
            { slug: { contains: term, mode: 'insensitive' } },
          ],
        },
        take: 10,
        select: { id: true, name: true, slug: true, status: true },
      }),
      this.prisma.user.findMany({
        where: {
          deletedAt: null,
          OR: [
            { email: { contains: term, mode: 'insensitive' } },
            { firstName: { contains: term, mode: 'insensitive' } },
            { lastName: { contains: term, mode: 'insensitive' } },
          ],
        },
        take: 10,
        select: { id: true, email: true, firstName: true, lastName: true },
      }),
      this.prisma.lead.findMany({
        where: {
          deletedAt: null,
          OR: [
            { email: { contains: term, mode: 'insensitive' } },
            { firstName: { contains: term, mode: 'insensitive' } },
            { lastName: { contains: term, mode: 'insensitive' } },
          ],
        },
        take: 10,
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          organizationId: true,
        },
      }),
    ]);

    return { organizations, users, leads };
  }

  async startImpersonation(params: {
    organizationId: string;
    platformAdminId: string;
    actorUserId: string;
    reason: string;
  }) {
    if (params.reason.trim().length < 8) {
      throw new BadRequestException('Impersonation reason must be at least 8 characters');
    }
    const org = await this.getOrganization(params.organizationId);
    const supportToken = await this.jwt.signAsync(
      {
        purpose: 'support_impersonation',
        organizationId: org.id,
        platformAdminId: params.platformAdminId,
        actorUserId: params.actorUserId,
        readOnly: true,
      },
      {
        secret: this.config.get('JWT_ACCESS_SECRET', { infer: true }),
        expiresIn: '15m',
      },
    );

    await this.audit.record({
      action: 'admin.impersonation.start',
      organizationId: org.id,
      actorUserId: params.actorUserId,
      platformAdminId: params.platformAdminId,
      targetType: 'organization',
      targetId: org.id,
      metadata: {
        reason: params.reason,
        readOnly: true,
        expiresIn: '15m',
      },
    });

    return {
      organizationId: org.id,
      organizationName: org.name,
      supportToken,
      expiresIn: '15m',
      readOnly: true,
      note: 'Support token is audited and short-lived. It must never be treated as a tenant owner session.',
    };
  }

  systemHealth() {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      services: {
        api: 'up',
        database: 'up',
      },
    };
  }
}
