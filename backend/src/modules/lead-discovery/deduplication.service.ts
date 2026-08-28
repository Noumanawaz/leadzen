import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import type { DedupeMatch, NormalizedLead } from './lead-source.types';
import { LeadValidationService } from './lead-validation.service';

@Injectable()
export class DeduplicationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly validation: LeadValidationService,
  ) {}

  async findMatch(
    organizationId: string,
    lead: NormalizedLead,
  ): Promise<DedupeMatch | null> {
    const email = this.validation.normalizeEmail(lead.email);
    if (email) {
      const byEmail = await this.prisma.lead.findFirst({
        where: { organizationId, deletedAt: null, email },
        select: { id: true },
      });
      if (byEmail) return { leadId: byEmail.id, reason: 'email' };
    }

    const phone = this.validation.normalizePhone(lead.phone);
    if (phone) {
      const byPhone = await this.prisma.lead.findFirst({
        where: { organizationId, deletedAt: null, phone },
        select: { id: true },
      });
      if (byPhone) return { leadId: byPhone.id, reason: 'phone' };
    }

    if (lead.sourceType && lead.sourceExternalId) {
      const byExt = await this.prisma.lead.findFirst({
        where: {
          organizationId,
          deletedAt: null,
          sourceType: lead.sourceType,
          sourceExternalId: lead.sourceExternalId,
        },
        select: { id: true },
      });
      if (byExt) return { leadId: byExt.id, reason: 'external_id' };
    }

    const domain =
      this.validation.normalizeDomain(lead.companyDomain) ??
      this.validation.normalizeDomain(lead.website);
    const name = [lead.firstName, lead.lastName]
      .filter(Boolean)
      .join(' ')
      .trim()
      .toLowerCase();

    if (domain && name) {
      const candidates = await this.prisma.lead.findMany({
        where: {
          organizationId,
          deletedAt: null,
          OR: [
            { website: { contains: domain, mode: 'insensitive' } },
            { company: { website: { contains: domain, mode: 'insensitive' } } },
          ],
        },
        select: { id: true, firstName: true, lastName: true },
        take: 25,
      });
      const hit = candidates.find((c) => {
        const n = [c.firstName, c.lastName]
          .filter(Boolean)
          .join(' ')
          .trim()
          .toLowerCase();
        return n === name;
      });
      if (hit) return { leadId: hit.id, reason: 'website_name' };
    }

    if (lead.companyName && name) {
      const company = await this.prisma.company.findFirst({
        where: {
          organizationId,
          deletedAt: null,
          name: { equals: lead.companyName, mode: 'insensitive' },
        },
        select: { id: true },
      });
      if (company) {
        const byCompany = await this.prisma.lead.findFirst({
          where: {
            organizationId,
            deletedAt: null,
            companyId: company.id,
            OR: [
              {
                AND: [
                  { firstName: { equals: lead.firstName ?? undefined, mode: 'insensitive' } },
                  { lastName: { equals: lead.lastName ?? undefined, mode: 'insensitive' } },
                ],
              },
            ],
          },
          select: { id: true },
        });
        if (byCompany) return { leadId: byCompany.id, reason: 'company_name' };
      }
    }

    return null;
  }
}
