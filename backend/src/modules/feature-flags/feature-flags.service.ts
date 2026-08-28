import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class FeatureFlagsService {
  constructor(private readonly prisma: PrismaService) {}

  list() {
    return this.prisma.featureFlag.findMany({
      orderBy: { key: 'asc' },
      include: { overrides: true },
    });
  }

  async isEnabled(key: string, organizationId?: string): Promise<boolean> {
    const flag = await this.prisma.featureFlag.findUnique({ where: { key } });
    if (!flag) return false;
    if (!organizationId) return flag.enabled;

    const override = await this.prisma.featureFlagOverride.findUnique({
      where: {
        featureFlagId_organizationId: {
          featureFlagId: flag.id,
          organizationId,
        },
      },
    });
    return override ? override.enabled : flag.enabled;
  }

  async setGlobal(key: string, enabled: boolean, description?: string) {
    return this.prisma.featureFlag.upsert({
      where: { key },
      create: { key, enabled, description },
      update: { enabled, description },
    });
  }

  async setOverride(params: {
    key: string;
    organizationId: string;
    enabled: boolean;
  }) {
    const flag = await this.prisma.featureFlag.upsert({
      where: { key: params.key },
      create: { key: params.key, enabled: false },
      update: {},
    });
    return this.prisma.featureFlagOverride.upsert({
      where: {
        featureFlagId_organizationId: {
          featureFlagId: flag.id,
          organizationId: params.organizationId,
        },
      },
      create: {
        featureFlagId: flag.id,
        organizationId: params.organizationId,
        enabled: params.enabled,
      },
      update: { enabled: params.enabled },
    });
  }

  forOrganization(organizationId: string) {
    return this.prisma.featureFlag.findMany({
      orderBy: { key: 'asc' },
      include: {
        overrides: {
          where: { organizationId },
        },
      },
    }).then((flags) =>
      flags.map((f) => ({
        key: f.key,
        description: f.description,
        enabled: f.overrides[0]?.enabled ?? f.enabled,
      })),
    );
  }
}
