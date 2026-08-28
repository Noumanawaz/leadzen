import { BadRequestException, Injectable } from '@nestjs/common';
import {
  ActivityType,
  type LeadSourceType,
  type Prisma,
} from '../../../generated/prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { CreditService } from '../credits/credit.service';
import { CreditCostService } from './credit-cost.service';
import { CompanyContactUpsertService } from './company-contact-upsert.service';
import { DeduplicationService } from './deduplication.service';
import { LeadScoringService } from './lead-scoring.service';
import type {
  CommitResult,
  DuplicatePolicyName,
  LeadSearchResult,
  NormalizedLead,
} from './lead-source.types';
import { LeadValidationService } from './lead-validation.service';

@Injectable()
export class LeadDiscoveryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly validation: LeadValidationService,
    private readonly dedupe: DeduplicationService,
    private readonly scoring: LeadScoringService,
    private readonly companies: CompanyContactUpsertService,
    private readonly credits: CreditService,
    private readonly creditCosts: CreditCostService,
  ) {}

  async preview(
    organizationId: string,
    leads: NormalizedLead[],
  ): Promise<LeadSearchResult[]> {
    const out: LeadSearchResult[] = [];
    for (const raw of leads) {
      const { lead } = this.validation.sanitize(raw);
      const duplicate = await this.dedupe.findMatch(organizationId, lead);
      out.push({ ...lead, duplicate });
    }
    return out;
  }

  async commit(params: {
    organizationId: string;
    actorUserId?: string;
    leads: NormalizedLead[];
    duplicatePolicy?: DuplicatePolicyName;
    creditCostCode?: string;
    creditPerLead?: number;
  }): Promise<CommitResult> {
    const policy = params.duplicatePolicy ?? 'skip';
    const result: CommitResult = {
      created: 0,
      updated: 0,
      skipped: 0,
      failed: 0,
      creditsUsed: 0,
      leadIds: [],
      errors: [],
    };

    let pipelineId: string | undefined;
    let pipelineStageId: string | undefined;
    const pipeline = await this.prisma.pipeline.findFirst({
      where: { organizationId: params.organizationId },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
      include: { stages: { orderBy: { position: 'asc' }, take: 1 } },
    });
    if (pipeline) {
      pipelineId = pipeline.id;
      pipelineStageId = pipeline.stages[0]?.id;
    }

    const costPerLead =
      params.creditPerLead ??
      (params.creditCostCode
        ? await this.creditCosts.resolve(params.creditCostCode)
        : 0);

    const debitLead = async (metadata?: Record<string, unknown>) => {
      if (costPerLead <= 0) return;
      const balance = await this.credits.getBalance(params.organizationId);
      if (balance < costPerLead) {
        throw new BadRequestException(
          `Insufficient platform credits. Need ${costPerLead}, balance is ${balance}.`,
        );
      }
      await this.credits.debit({
        organizationId: params.organizationId,
        amount: costPerLead,
        reason: params.creditCostCode ?? 'lead_import',
        createdByUserId: params.actorUserId,
        metadata: metadata as Prisma.InputJsonValue | undefined,
      });
      result.creditsUsed += costPerLead;
    };

    for (let index = 0; index < params.leads.length; index++) {
      try {
        const sanitized = this.validation.sanitize(params.leads[index]!);
        if (!sanitized.ok) {
          result.failed += 1;
          result.errors.push({
            index,
            message: sanitized.errors.join('; '),
          });
          continue;
        }
        const lead = sanitized.lead;
        const match = await this.dedupe.findMatch(params.organizationId, lead);

        if (match && policy === 'skip') {
          result.skipped += 1;
          result.leadIds.push(match.leadId);
          continue;
        }

        if (match && policy === 'create') {
          // fall through to create another row
        } else if (match && (policy === 'update' || policy === 'merge')) {
          await debitLead({ leadId: match.leadId, action: 'update' });
          const updated = await this.updateExisting(
            params.organizationId,
            match.leadId,
            lead,
            policy === 'merge',
          );
          result.updated += 1;
          result.leadIds.push(updated.id);
          continue;
        }

        await debitLead();
        const companyId = await this.companies.upsertCompany(
          params.organizationId,
          {
            name: lead.companyName,
            website: lead.website,
            domain: lead.companyDomain,
            country: lead.country,
          },
        );

        const created = await this.prisma.lead.create({
          data: {
            organizationId: params.organizationId,
            firstName: lead.firstName,
            lastName: lead.lastName,
            email: lead.email,
            phone: lead.phone,
            jobTitle: lead.jobTitle,
            website: lead.website,
            country: lead.country,
            state: lead.state,
            city: lead.city,
            companyId,
            source: lead.sourceName ?? lead.sourceType,
            sourceType: lead.sourceType,
            sourceId: lead.sourceId,
            sourceExternalId: lead.sourceExternalId,
            sourceName: lead.sourceName,
            sourceMetadata: (lead.sourceMetadata ??
              undefined) as Prisma.InputJsonValue | undefined,
            leadScore: this.scoring.score(lead),
            ownerId: params.actorUserId,
            pipelineId,
            pipelineStageId,
          },
        });

        await this.prisma.activity.create({
          data: {
            organizationId: params.organizationId,
            leadId: created.id,
            type: ActivityType.lead_created,
            title: `Lead imported from ${lead.sourceType}`,
            metadata: {
              sourceType: lead.sourceType,
              sourceExternalId: lead.sourceExternalId,
            },
          },
        });

        result.created += 1;
        result.leadIds.push(created.id);
      } catch (error) {
        result.failed += 1;
        result.errors.push({
          index,
          message: error instanceof Error ? error.message : 'Import failed',
        });
      }
    }

    return result;
  }

  listSources(organizationId: string) {
    return this.prisma.leadSource.findMany({
      where: { organizationId },
      orderBy: { createdAt: 'desc' },
    });
  }

  createSource(
    organizationId: string,
    data: {
      type: LeadSourceType;
      name: string;
      integrationId?: string;
      configuration?: Prisma.InputJsonValue;
    },
  ) {
    return this.prisma.leadSource.create({
      data: {
        organizationId,
        type: data.type,
        name: data.name,
        integrationId: data.integrationId,
        configuration: data.configuration ?? {},
      },
    });
  }

  private async updateExisting(
    organizationId: string,
    leadId: string,
    lead: NormalizedLead,
    merge: boolean,
  ) {
    const existing = await this.prisma.lead.findFirst({
      where: { id: leadId, organizationId, deletedAt: null },
    });
    if (!existing) {
      throw new Error('Lead not found for update');
    }

    const companyId =
      existing.companyId ??
      (await this.companies.upsertCompany(organizationId, {
        name: lead.companyName,
        website: lead.website,
        domain: lead.companyDomain,
        country: lead.country,
      }));

    const pick = <T>(next: T | null | undefined, prev: T): T => {
      if (!merge) return (next ?? prev) as T;
      return (next ?? prev) as T;
    };

    return this.prisma.lead.update({
      where: { id: leadId },
      data: {
        firstName: pick(lead.firstName, existing.firstName),
        lastName: pick(lead.lastName, existing.lastName),
        email: pick(lead.email, existing.email),
        phone: pick(lead.phone, existing.phone),
        jobTitle: pick(lead.jobTitle, existing.jobTitle),
        website: pick(lead.website, existing.website),
        country: pick(lead.country, existing.country),
        state: pick(lead.state, existing.state),
        city: pick(lead.city, existing.city),
        companyId,
        sourceType: lead.sourceType,
        sourceId: lead.sourceId ?? existing.sourceId,
        sourceExternalId: lead.sourceExternalId ?? existing.sourceExternalId,
        sourceName: lead.sourceName ?? existing.sourceName,
        sourceMetadata: (lead.sourceMetadata ??
          existing.sourceMetadata) as Prisma.InputJsonValue | undefined,
        leadScore: Math.max(existing.leadScore, this.scoring.score(lead)),
      },
    });
  }
}
