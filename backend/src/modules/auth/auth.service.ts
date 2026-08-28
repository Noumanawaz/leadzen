import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { randomBytes } from 'crypto';
import {
  CreditTransactionType,
  MembershipRole,
  MembershipStatus,
} from '../../../generated/prisma/client';
import { sha256 } from '../../common/encryption/token-encryption';
import type { AppEnv } from '../../config/env.validation';
import { PrismaService } from '../../database/prisma.service';
import { AuditService } from '../audit/audit.service';
import { CreditService } from '../credits/credit.service';
import { LoginDto, RegisterDto } from './dto/auth.dto';

function slugify(name: string): string {
  const base = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 48);
  return base || 'org';
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService<AppEnv, true>,
    private readonly credits: CreditService,
    private readonly audit: AuditService,
  ) {}

  async register(dto: RegisterDto) {
    const email = dto.email.toLowerCase().trim();
    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) {
      throw new ConflictException('Email already registered');
    }

    const passwordHash = await bcrypt.hash(dto.password, 12);
    let slug = slugify(dto.organizationName);
    const slugTaken = await this.prisma.organization.findUnique({
      where: { slug },
    });
    if (slugTaken) {
      slug = `${slug}-${randomBytes(3).toString('hex')}`;
    }

    const trialPlan = await this.prisma.plan.findUnique({
      where: { code: 'trial' },
    });

    const result = await this.prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email,
          passwordHash,
          firstName: dto.firstName,
          lastName: dto.lastName,
        },
      });

      const organization = await tx.organization.create({
        data: {
          name: dto.organizationName.trim(),
          slug,
          planId: trialPlan?.id,
          status: 'trial',
        },
      });

      const membership = await tx.membership.create({
        data: {
          organizationId: organization.id,
          userId: user.id,
          role: MembershipRole.owner,
          status: MembershipStatus.active,
        },
      });

      return { user, organization, membership };
    });

    await this.credits.ensureAccount(result.organization.id);
    if (trialPlan) {
      await this.credits.grant({
        organizationId: result.organization.id,
        amount: trialPlan.includedAiCredits,
        type: CreditTransactionType.subscription_grant,
        reason: 'Trial plan included AI credits',
        createdByUserId: result.user.id,
      });
    }
    await this.credits.grant({
      organizationId: result.organization.id,
      amount: 50,
      type: CreditTransactionType.subscription_grant,
      reason: 'Welcome platform credits',
      createdByUserId: result.user.id,
      metadata: { kind: 'welcome_bonus' },
    });

    await this.audit.record({
      action: 'user_registered',
      organizationId: result.organization.id,
      actorUserId: result.user.id,
      targetType: 'organization',
      targetId: result.organization.id,
    });

    const tokens = await this.issueTokens(result.user.id, result.user.email);
    return {
      user: this.publicUser(result.user),
      organization: {
        id: result.organization.id,
        name: result.organization.name,
        slug: result.organization.slug,
      },
      membership: {
        id: result.membership.id,
        role: result.membership.role,
      },
      ...tokens,
    };
  }

  async login(dto: LoginDto) {
    const email = dto.email.toLowerCase().trim();
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user || user.deletedAt) {
      throw new UnauthorizedException('Invalid credentials');
    }
    const ok = await bcrypt.compare(dto.password, user.passwordHash);
    if (!ok) {
      throw new UnauthorizedException('Invalid credentials');
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    await this.audit.record({
      action: 'user_login',
      actorUserId: user.id,
    });

    const memberships = await this.prisma.membership.findMany({
      where: { userId: user.id, status: MembershipStatus.active },
      include: {
        organization: {
          select: { id: true, name: true, slug: true, status: true },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    const tokens = await this.issueTokens(user.id, user.email);
    return {
      user: this.publicUser(user),
      organizations: memberships.map((m) => ({
        membershipId: m.id,
        role: m.role,
        organization: m.organization,
      })),
      ...tokens,
    };
  }

  async refresh(refreshToken: string) {
    const tokenHash = sha256(refreshToken);
    const stored = await this.prisma.refreshToken.findFirst({
      where: {
        tokenHash,
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
      include: { user: true },
    });
    if (!stored || stored.user.deletedAt) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    await this.prisma.refreshToken.update({
      where: { id: stored.id },
      data: { revokedAt: new Date() },
    });

    return this.issueTokens(stored.user.id, stored.user.email);
  }

  async me(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || user.deletedAt) {
      throw new UnauthorizedException();
    }
    const memberships = await this.prisma.membership.findMany({
      where: { userId, status: MembershipStatus.active },
      include: {
        organization: {
          select: { id: true, name: true, slug: true, status: true },
        },
      },
    });
    return {
      user: this.publicUser(user),
      organizations: memberships.map((m) => ({
        membershipId: m.id,
        role: m.role,
        organization: m.organization,
      })),
    };
  }

  private async issueTokens(userId: string, email: string) {
    const accessToken = await this.jwt.signAsync(
      { sub: userId, email },
      {
        secret: this.config.get('JWT_ACCESS_SECRET', { infer: true }),
        expiresIn: this.config.get('JWT_ACCESS_TTL', { infer: true }),
      },
    );

    const refreshToken = randomBytes(48).toString('hex');
    const ttl = this.config.get('JWT_REFRESH_TTL', { infer: true });
    const days = ttl.endsWith('d') ? Number(ttl.slice(0, -1)) : 7;
    const expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000);

    await this.prisma.refreshToken.create({
      data: {
        userId,
        tokenHash: sha256(refreshToken),
        expiresAt,
      },
    });

    return { accessToken, refreshToken };
  }

  private publicUser(user: {
    id: string;
    email: string;
    firstName: string | null;
    lastName: string | null;
  }) {
    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
    };
  }
}
