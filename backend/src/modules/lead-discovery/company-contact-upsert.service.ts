import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { LeadValidationService } from './lead-validation.service';

@Injectable()
export class CompanyContactUpsertService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly validation: LeadValidationService,
  ) {}

  async upsertCompany(
    organizationId: string,
    params: {
      name?: string | null;
      website?: string | null;
      domain?: string | null;
      country?: string | null;
    },
  ): Promise<string | null> {
    const name = params.name?.trim();
    if (!name) return null;

    const domain =
      this.validation.normalizeDomain(params.domain) ??
      this.validation.normalizeDomain(params.website);

    if (domain) {
      const byDomain = await this.prisma.company.findFirst({
        where: {
          organizationId,
          deletedAt: null,
          website: { contains: domain, mode: 'insensitive' },
        },
        select: { id: true },
      });
      if (byDomain) return byDomain.id;
    }

    const byName = await this.prisma.company.findFirst({
      where: {
        organizationId,
        deletedAt: null,
        name: { equals: name, mode: 'insensitive' },
      },
      select: { id: true },
    });
    if (byName) return byName.id;

    const created = await this.prisma.company.create({
      data: {
        organizationId,
        name,
        website: params.website ?? (domain ? `https://${domain}` : null),
        country: params.country ?? undefined,
      },
      select: { id: true },
    });
    return created.id;
  }
}
