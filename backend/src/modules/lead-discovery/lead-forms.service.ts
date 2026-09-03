import { Injectable, NotFoundException } from '@nestjs/common';
import { createHash, randomBytes } from 'crypto';
import type { Prisma } from '../../../generated/prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { LeadDiscoveryService } from './lead-discovery.service';
import type { NormalizedLead } from './lead-source.types';

@Injectable()
export class LeadFormsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly discovery: LeadDiscoveryService,
  ) {}

  list(organizationId: string) {
    return this.prisma.leadForm.findMany({
      where: { organizationId },
      orderBy: { createdAt: 'desc' },
    });
  }

  create(
    organizationId: string,
    data: {
      name: string;
      fields?: unknown;
      automation?: unknown;
      spamSettings?: unknown;
    },
  ) {
    return this.prisma.leadForm.create({
      data: {
        organizationId,
        publicId: `lf_${randomBytes(12).toString('hex')}`,
        name: data.name,
        fields: (data.fields as never) ?? [
          { key: 'email', label: 'Email', type: 'email', required: true },
          { key: 'firstName', label: 'First name', type: 'text', required: false },
          { key: 'lastName', label: 'Last name', type: 'text', required: false },
          { key: 'companyName', label: 'Company', type: 'text', required: false },
        ],
        automation: (data.automation as never) ?? {
          description: "Fill out the form below and we'll be in touch.",
          submitLabel: 'Submit',
        },
        spamSettings: (data.spamSettings as never) ?? { honeypot: true },
      },
    });
  }

  async update(
    organizationId: string,
    id: string,
    data: {
      name?: string;
      fields?: unknown;
      automation?: unknown;
      spamSettings?: unknown;
      isActive?: boolean;
    },
  ) {
    const existing = await this.prisma.leadForm.findFirst({
      where: { id, organizationId },
    });
    if (!existing) throw new NotFoundException('Form not found');

    return this.prisma.leadForm.update({
      where: { id },
      data: {
        ...(data.name !== undefined ? { name: data.name } : {}),
        ...(data.fields !== undefined
          ? { fields: data.fields as never }
          : {}),
        ...(data.automation !== undefined
          ? { automation: data.automation as never }
          : {}),
        ...(data.spamSettings !== undefined
          ? { spamSettings: data.spamSettings as never }
          : {}),
        ...(data.isActive !== undefined ? { isActive: data.isActive } : {}),
      },
    });
  }

  async getPublic(publicId: string) {
    const form = await this.prisma.leadForm.findFirst({
      where: { publicId, isActive: true },
      select: {
        publicId: true,
        name: true,
        fields: true,
        automation: true,
        spamSettings: true,
      },
    });
    if (!form) throw new NotFoundException('Form not found');
    const automation = (form.automation ?? {}) as {
      description?: string;
      submitLabel?: string;
    };
    const spam = (form.spamSettings ?? {}) as { honeypot?: boolean };
    return {
      publicId: form.publicId,
      name: form.name,
      fields: form.fields,
      description:
        automation.description ??
        "Fill out the form below and we'll be in touch.",
      submitLabel: automation.submitLabel ?? 'Submit',
      honeypot: spam.honeypot !== false,
    };
  }

  async submit(
    publicId: string,
    payload: Record<string, unknown>,
    meta?: { ip?: string; userAgent?: string },
  ) {
    const form = await this.prisma.leadForm.findFirst({
      where: { publicId, isActive: true },
    });
    if (!form) throw new NotFoundException('Form not found');

    const spam = (form.spamSettings ?? {}) as { honeypot?: boolean };
    if (spam.honeypot && payload.website_url) {
      return { ok: true, skipped: true };
    }

    const lead: NormalizedLead = {
      firstName: String(payload.firstName ?? payload.first_name ?? '') || null,
      lastName: String(payload.lastName ?? payload.last_name ?? '') || null,
      email: String(payload.email ?? '') || null,
      phone: String(payload.phone ?? '') || null,
      companyName:
        String(payload.companyName ?? payload.company ?? '') || null,
      website: String(payload.website ?? '') || null,
      sourceType: 'website_form',
      sourceId: form.id,
      sourceName: form.name,
      sourceMetadata: { publicId, payload },
    };

    const result = await this.discovery.commit({
      organizationId: form.organizationId,
      leads: [lead],
      duplicatePolicy: 'merge',
    });

    const leadId = result.leadIds[0] ?? null;
    await this.prisma.leadFormSubmission.create({
      data: {
        leadFormId: form.id,
        payload: payload as Prisma.InputJsonValue,
        leadId,
        ipHash: meta?.ip
          ? createHash('sha256').update(meta.ip).digest('hex')
          : null,
        userAgent: meta?.userAgent?.slice(0, 500),
      },
    });
    await this.prisma.leadForm.update({
      where: { id: form.id },
      data: { submissionCount: { increment: 1 } },
    });

    return { ok: true, leadId };
  }
}
