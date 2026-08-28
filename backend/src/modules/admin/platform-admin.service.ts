import { ForbiddenException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  PlatformAdminStatus,
} from '../../../generated/prisma/client';
import type { AppEnv } from '../../config/env.validation';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class PlatformAdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService<AppEnv, true>,
  ) {}

  parseAllowlist(): string[] {
    const raw = this.config.get('ADMIN_EMAIL_ALLOWLIST', { infer: true }) ?? '';
    return raw
      .split(',')
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean);
  }

  isAllowlisted(email: string): boolean {
    return this.parseAllowlist().includes(email.trim().toLowerCase());
  }

  /**
   * Returns active platform admin for user.
   * If missing but email is allowlisted, creates the row (env-only seed).
   */
  async resolveForUser(params: { userId: string; email: string }) {
    let admin = await this.prisma.platformAdmin.findUnique({
      where: { userId: params.userId },
    });

    if (!admin && this.isAllowlisted(params.email)) {
      admin = await this.prisma.platformAdmin.create({
        data: {
          userId: params.userId,
          status: PlatformAdminStatus.active,
          mfaRequired: false,
        },
      });
    }

    if (!admin) return null;

    if (admin.status === PlatformAdminStatus.active) {
      await this.prisma.platformAdmin.update({
        where: { id: admin.id },
        data: { lastLoginAt: new Date() },
      });
    }

    return admin;
  }

  async requireActive(params: { userId: string; email: string }) {
    const admin = await this.resolveForUser(params);
    if (!admin || admin.status !== PlatformAdminStatus.active) {
      throw new ForbiddenException('Platform admin access required');
    }
    return admin;
  }
}
