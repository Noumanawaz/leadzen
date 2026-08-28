import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { createHash, randomBytes } from 'crypto';
import { PrismaService } from '../../database/prisma.service';
import { LeadDiscoveryService } from './lead-discovery.service';
import type { NormalizedLead } from './lead-source.types';

@Injectable()
export class ReferralLinksService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly discovery: LeadDiscoveryService,
  ) {}

  list(organizationId: string) {
    return this.prisma.referralLink.findMany({
      where: { organizationId },
      orderBy: { createdAt: 'desc' },
    });
  }

  create(
    organizationId: string,
    data: {
      code?: string;
      name?: string;
      pipelineId?: string;
      sequenceId?: string;
    },
  ) {
    const code =
      data.code?.trim().toLowerCase().replace(/[^a-z0-9-_]/g, '') ||
      randomBytes(4).toString('hex');
    return this.prisma.referralLink.create({
      data: {
        organizationId,
        code,
        name: data.name,
        pipelineId: data.pipelineId,
        sequenceId: data.sequenceId,
      },
    });
  }

  async trackClick(code: string) {
    const link = await this.prisma.referralLink.findFirst({
      where: { code, isActive: true },
    });
    if (!link) throw new NotFoundException('Referral link not found');
    await this.prisma.referralLink.update({
      where: { id: link.id },
      data: { clickCount: { increment: 1 } },
    });
    return {
      code: link.code,
      organizationId: link.organizationId,
      name: link.name,
    };
  }

  async convert(
    code: string,
    payload: {
      email?: string;
      firstName?: string;
      lastName?: string;
      phone?: string;
      companyName?: string;
    },
  ) {
    const link = await this.prisma.referralLink.findFirst({
      where: { code, isActive: true },
    });
    if (!link) throw new NotFoundException('Referral link not found');

    const lead: NormalizedLead = {
      ...payload,
      sourceType: 'referral',
      sourceId: link.id,
      sourceName: link.name ?? `Referral ${link.code}`,
      sourceMetadata: { code: link.code },
    };

    const result = await this.discovery.commit({
      organizationId: link.organizationId,
      leads: [lead],
      duplicatePolicy: 'merge',
    });
    await this.prisma.referralLink.update({
      where: { id: link.id },
      data: { leadCount: { increment: result.created } },
    });
    return result;
  }
}

@Injectable()
export class OrganizationApiKeysService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly discovery: LeadDiscoveryService,
  ) {}

  list(organizationId: string) {
    return this.prisma.organizationApiKey.findMany({
      where: { organizationId, revokedAt: null },
      select: {
        id: true,
        name: true,
        keyPrefix: true,
        scopes: true,
        lastUsedAt: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async create(organizationId: string, name: string) {
    const raw = `lms_${randomBytes(24).toString('hex')}`;
    const keyHash = createHash('sha256').update(raw).digest('hex');
    const row = await this.prisma.organizationApiKey.create({
      data: {
        organizationId,
        name,
        keyPrefix: raw.slice(0, 12),
        keyHash,
      },
    });
    return {
      id: row.id,
      name: row.name,
      keyPrefix: row.keyPrefix,
      apiKey: raw,
      createdAt: row.createdAt,
    };
  }

  async revoke(organizationId: string, id: string) {
    const row = await this.prisma.organizationApiKey.findFirst({
      where: { id, organizationId },
    });
    if (!row) throw new NotFoundException('API key not found');
    await this.prisma.organizationApiKey.update({
      where: { id },
      data: { revokedAt: new Date() },
    });
    return { ok: true };
  }

  async ingestLead(
    bearerToken: string,
    payload: {
      email?: string;
      firstName?: string;
      lastName?: string;
      phone?: string;
      companyName?: string;
      website?: string;
      sourceName?: string;
    },
  ) {
    if (!bearerToken?.startsWith('lms_')) {
      throw new BadRequestException('Invalid API key');
    }
    const keyHash = createHash('sha256').update(bearerToken).digest('hex');
    const key = await this.prisma.organizationApiKey.findFirst({
      where: { keyHash, revokedAt: null },
    });
    if (!key) throw new NotFoundException('API key not found');

    await this.prisma.organizationApiKey.update({
      where: { id: key.id },
      data: { lastUsedAt: new Date() },
    });

    const lead: NormalizedLead = {
      email: payload.email,
      firstName: payload.firstName,
      lastName: payload.lastName,
      phone: payload.phone,
      companyName: payload.companyName,
      website: payload.website,
      sourceType: 'api',
      sourceId: key.id,
      sourceName: payload.sourceName ?? 'Public API',
    };

    return this.discovery.commit({
      organizationId: key.organizationId,
      leads: [lead],
      duplicatePolicy: 'merge',
    });
  }
}
