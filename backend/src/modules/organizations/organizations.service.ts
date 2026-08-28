import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomBytes } from 'crypto';
import {
  MembershipRole,
  MembershipStatus,
} from '../../../generated/prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { AuditService } from '../audit/audit.service';
import { CreditService } from '../credits/credit.service';
import { EntitlementService } from '../entitlements/entitlement.service';
import { PermissionService } from '../permissions/permission.service';
import {
  CreateOrganizationDto,
  InviteMemberDto,
  UpdateMemberRoleDto,
  UpdateOrganizationDto,
  CompleteInviteDto,
} from './dto/organizations.dto';
import * as bcrypt from 'bcrypt';

function slugify(name: string): string {
  const base = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 48);
  return base || 'org';
}

@Injectable()
export class OrganizationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly entitlements: EntitlementService,
    private readonly credits: CreditService,
    private readonly audit: AuditService,
    private readonly permissions: PermissionService,
  ) {}

  async listForUser(userId: string) {
    const memberships = await this.prisma.membership.findMany({
      where: { userId, status: MembershipStatus.active },
      include: {
        organization: {
          select: {
            id: true,
            name: true,
            slug: true,
            status: true,
            timezone: true,
            currency: true,
            locale: true,
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });
    return memberships.map((m) => ({
      membershipId: m.id,
      role: m.role,
      permissions: this.permissions.permissionsFor(m.role),
      organization: m.organization,
    }));
  }

  async create(userId: string, dto: CreateOrganizationDto) {
    let slug = slugify(dto.name);
    if (await this.prisma.organization.findUnique({ where: { slug } })) {
      slug = `${slug}-${randomBytes(3).toString('hex')}`;
    }
    const trialPlan = await this.prisma.plan.findUnique({
      where: { code: 'trial' },
    });

    const organization = await this.prisma.organization.create({
      data: {
        name: dto.name.trim(),
        slug,
        timezone: dto.timezone ?? 'UTC',
        currency: dto.currency ?? 'USD',
        locale: dto.locale ?? 'en-US',
        planId: trialPlan?.id,
        memberships: {
          create: {
            userId,
            role: MembershipRole.owner,
            status: MembershipStatus.active,
          },
        },
      },
    });

    await this.credits.ensureAccount(organization.id);
    if (trialPlan) {
      await this.credits.grant({
        organizationId: organization.id,
        amount: trialPlan.includedAiCredits,
        type: 'subscription_grant',
        reason: 'Trial plan included AI credits',
        createdByUserId: userId,
      });
    }
    await this.credits.grant({
      organizationId: organization.id,
      amount: 50,
      type: 'subscription_grant',
      reason: 'Welcome platform credits',
      createdByUserId: userId,
      metadata: { kind: 'welcome_bonus' },
    });

    await this.audit.record({
      action: 'organization_created',
      organizationId: organization.id,
      actorUserId: userId,
      targetType: 'organization',
      targetId: organization.id,
    });

    return organization;
  }

  async getCurrent(organizationId: string) {
    const org = await this.prisma.organization.findFirst({
      where: { id: organizationId, deletedAt: null },
      include: {
        plan: true,
        creditAccount: { select: { balance: true } },
      },
    });
    if (!org) {
      throw new NotFoundException('Organization not found');
    }
    return {
      ...org,
      plan: org.plan
        ? {
            ...org.plan,
            maxStorageBytes: org.plan.maxStorageBytes.toString(),
          }
        : null,
    };
  }

  async listMembers(organizationId: string) {
    return this.prisma.membership.findMany({
      where: {
        organizationId,
        status: { in: [MembershipStatus.active, MembershipStatus.invited] },
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  async invite(
    organizationId: string,
    actorUserId: string,
    actorRole: MembershipRole,
    dto: InviteMemberDto,
  ) {
    if (!this.permissions.can(actorRole, 'members:invite')) {
      throw new ForbiddenException('Missing permission: members:invite');
    }
    if (dto.role === MembershipRole.owner) {
      throw new BadRequestException('Cannot invite as owner');
    }

    await this.entitlements.assertCanAddMember(organizationId);

    const email = dto.email.toLowerCase().trim();
    let user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) {
      // Placeholder user — must set password via invite accept (Phase 1: create inactive shell)
      user = await this.prisma.user.create({
        data: {
          email,
          passwordHash: await import('bcrypt').then((b) =>
            b.hash(randomBytes(32).toString('hex'), 12),
          ),
          status: 'invited',
        },
      });
    }

    const existing = await this.prisma.membership.findUnique({
      where: {
        organizationId_userId: { organizationId, userId: user.id },
      },
    });
    if (existing && existing.status !== MembershipStatus.removed) {
      throw new BadRequestException('User already a member');
    }

    const inviteToken = randomBytes(24).toString('hex');
    const membership = await this.prisma.membership.upsert({
      where: {
        organizationId_userId: { organizationId, userId: user.id },
      },
      create: {
        organizationId,
        userId: user.id,
        role: dto.role,
        status: MembershipStatus.invited,
        inviteToken,
        inviteExpiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
      update: {
        role: dto.role,
        status: MembershipStatus.invited,
        inviteToken,
        inviteExpiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });

    await this.audit.record({
      action: 'member_invited',
      organizationId,
      actorUserId,
      targetType: 'membership',
      targetId: membership.id,
      metadata: { email, role: dto.role },
    });

    return {
      membershipId: membership.id,
      email,
      role: membership.role,
      inviteToken,
      invitePath: `/invite/${inviteToken}`,
      status: membership.status,
    };
  }

  async getInvitePreview(inviteToken: string) {
    const membership = await this.prisma.membership.findFirst({
      where: {
        inviteToken,
        status: MembershipStatus.invited,
        inviteExpiresAt: { gt: new Date() },
      },
      include: {
        organization: { select: { id: true, name: true } },
        user: { select: { email: true, firstName: true, lastName: true, status: true } },
      },
    });
    if (!membership) {
      throw new NotFoundException('Invite not found or expired');
    }
    return {
      email: membership.user.email,
      organizationName: membership.organization.name,
      organizationId: membership.organization.id,
      role: membership.role,
      expiresAt: membership.inviteExpiresAt,
      needsPassword: membership.user.status === 'invited',
    };
  }

  async completeInvite(inviteToken: string, dto: CompleteInviteDto) {
    const membership = await this.prisma.membership.findFirst({
      where: {
        inviteToken,
        status: MembershipStatus.invited,
        inviteExpiresAt: { gt: new Date() },
      },
      include: { user: true, organization: { select: { id: true, name: true } } },
    });
    if (!membership) {
      throw new NotFoundException('Invite not found or expired');
    }

    const passwordHash = await bcrypt.hash(dto.password, 12);
    await this.prisma.user.update({
      where: { id: membership.userId },
      data: {
        passwordHash,
        status: 'active',
        firstName: dto.firstName ?? membership.user.firstName,
        lastName: dto.lastName ?? membership.user.lastName,
      },
    });

    await this.prisma.membership.update({
      where: { id: membership.id },
      data: {
        status: MembershipStatus.active,
        inviteToken: null,
        inviteExpiresAt: null,
      },
    });

    return {
      userId: membership.userId,
      email: membership.user.email,
      organizationId: membership.organizationId,
      organizationName: membership.organization.name,
    };
  }

  async updateCurrent(organizationId: string, dto: UpdateOrganizationDto) {
    await this.getCurrent(organizationId);
    return this.prisma.organization.update({
      where: { id: organizationId },
      data: {
        ...(dto.name ? { name: dto.name.trim() } : {}),
        ...(dto.timezone ? { timezone: dto.timezone } : {}),
        ...(dto.currency ? { currency: dto.currency } : {}),
        ...(dto.locale ? { locale: dto.locale } : {}),
        ...(dto.businessHoursStart != null
          ? { businessHoursStart: dto.businessHoursStart }
          : {}),
        ...(dto.businessHoursEnd != null
          ? { businessHoursEnd: dto.businessHoursEnd }
          : {}),
        ...(dto.workingDays ? { workingDays: dto.workingDays } : {}),
      },
    });
  }

  async updateRole(
    organizationId: string,
    membershipId: string,
    actorUserId: string,
    actorRole: MembershipRole,
    dto: UpdateMemberRoleDto,
  ) {
    if (!this.permissions.can(actorRole, 'members:update_role')) {
      throw new ForbiddenException('Missing permission: members:update_role');
    }
    if (dto.role === MembershipRole.owner && actorRole !== MembershipRole.owner) {
      throw new ForbiddenException('Only owner can assign owner role');
    }

    const membership = await this.prisma.membership.findFirst({
      where: { id: membershipId, organizationId },
    });
    if (!membership) {
      throw new NotFoundException('Membership not found');
    }
    if (membership.role === MembershipRole.owner && dto.role !== MembershipRole.owner) {
      const owners = await this.prisma.membership.count({
        where: {
          organizationId,
          role: MembershipRole.owner,
          status: MembershipStatus.active,
        },
      });
      if (owners <= 1) {
        throw new BadRequestException('Cannot demote the sole owner');
      }
    }

    const updated = await this.prisma.membership.update({
      where: { id: membership.id },
      data: { role: dto.role },
    });

    await this.audit.record({
      action: 'member_role_changed',
      organizationId,
      actorUserId,
      targetType: 'membership',
      targetId: membership.id,
      metadata: { from: membership.role, to: dto.role },
    });

    return updated;
  }

  async acceptInvite(userId: string, inviteToken: string) {
    const membership = await this.prisma.membership.findFirst({
      where: {
        inviteToken,
        status: MembershipStatus.invited,
        inviteExpiresAt: { gt: new Date() },
      },
    });
    if (!membership) {
      throw new NotFoundException('Invite not found or expired');
    }
    if (membership.userId !== userId) {
      throw new ForbiddenException('Invite belongs to a different user');
    }

    return this.prisma.membership.update({
      where: { id: membership.id },
      data: {
        status: MembershipStatus.active,
        inviteToken: null,
        inviteExpiresAt: null,
      },
    });
  }
}
