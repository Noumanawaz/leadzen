import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  PrivacyRequestStatus,
  PrivacyRequestType,
} from '../../../generated/prisma/client';
import type { AppEnv } from '../../config/env.validation';
import { PrismaService } from '../../database/prisma.service';
import { AuditService } from '../audit/audit.service';
import { SuppressionsService } from '../suppressions/suppressions.service';

@Injectable()
export class PrivacyService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly config: ConfigService<AppEnv, true>,
    private readonly suppressions: SuppressionsService,
  ) {}

  retentionDays() {
    return this.config.get('DATA_RETENTION_DAYS', { infer: true });
  }

  list(organizationId: string) {
    return this.prisma.privacyRequest.findMany({
      where: { organizationId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  async requestExport(params: {
    organizationId: string;
    userId: string;
    subjectEmail?: string;
  }) {
    const request = await this.prisma.privacyRequest.create({
      data: {
        organizationId: params.organizationId,
        type: PrivacyRequestType.export,
        status: PrivacyRequestStatus.processing,
        subjectEmail: params.subjectEmail,
        requestedByUserId: params.userId,
      },
    });

    try {
      const payload = await this.buildExport(
        params.organizationId,
        params.subjectEmail,
      );
      const completed = await this.prisma.privacyRequest.update({
        where: { id: request.id },
        data: {
          status: PrivacyRequestStatus.completed,
          resultPayload: payload as never,
          completedAt: new Date(),
        },
      });
      await this.audit.record({
        action: 'privacy.export',
        organizationId: params.organizationId,
        actorUserId: params.userId,
        targetType: 'privacy_request',
        targetId: request.id,
      });
      return completed;
    } catch (err) {
      await this.prisma.privacyRequest.update({
        where: { id: request.id },
        data: {
          status: PrivacyRequestStatus.failed,
          error: err instanceof Error ? err.message : 'export failed',
        },
      });
      throw err;
    }
  }

  async requestDelete(params: {
    organizationId: string;
    userId: string;
    subjectEmail: string;
  }) {
    const request = await this.prisma.privacyRequest.create({
      data: {
        organizationId: params.organizationId,
        type: PrivacyRequestType.delete,
        status: PrivacyRequestStatus.processing,
        subjectEmail: params.subjectEmail,
        requestedByUserId: params.userId,
      },
    });

    try {
      const email = params.subjectEmail.trim().toLowerCase();
      const leads = await this.prisma.lead.findMany({
        where: {
          organizationId: params.organizationId,
          email: { equals: email, mode: 'insensitive' },
          deletedAt: null,
        },
        select: { id: true },
      });

      const leadIds = leads.map((l) => l.id);
      if (leadIds.length) {
        await this.prisma.note.deleteMany({
          where: {
            leadId: { in: leadIds },
            organizationId: params.organizationId,
          },
        });
        await this.prisma.lead.updateMany({
          where: {
            id: { in: leadIds },
            organizationId: params.organizationId,
          },
          data: {
            deletedAt: new Date(),
            email: null,
            phone: null,
            firstName: null,
            lastName: null,
          },
        });
      }

      const already = await this.suppressions.isEmailSuppressed(
        params.organizationId,
        email,
      );
      if (!already) {
        await this.suppressions.addEmail(
          params.organizationId,
          email,
          'gdpr_delete',
          'privacy_request',
        );
      }

      const completed = await this.prisma.privacyRequest.update({
        where: { id: request.id },
        data: {
          status: PrivacyRequestStatus.completed,
          resultPayload: {
            deletedLeadIds: leadIds,
            count: leadIds.length,
          },
          completedAt: new Date(),
        },
      });

      await this.audit.record({
        action: 'privacy.delete',
        organizationId: params.organizationId,
        actorUserId: params.userId,
        targetType: 'privacy_request',
        targetId: request.id,
        metadata: { subjectEmail: email, deletedLeadIds: leadIds },
      });

      return completed;
    } catch (err) {
      await this.prisma.privacyRequest.update({
        where: { id: request.id },
        data: {
          status: PrivacyRequestStatus.failed,
          error: err instanceof Error ? err.message : 'delete failed',
        },
      });
      throw err;
    }
  }

  async get(organizationId: string, id: string) {
    const row = await this.prisma.privacyRequest.findFirst({
      where: { id, organizationId },
    });
    if (!row) throw new NotFoundException('Privacy request not found');
    return row;
  }

  private async buildExport(organizationId: string, subjectEmail?: string) {
    const leadWhere = {
      organizationId,
      deletedAt: null,
      ...(subjectEmail
        ? { email: { equals: subjectEmail, mode: 'insensitive' as const } }
        : {}),
    };

    const [leads, contacts, notes, messages] = await Promise.all([
      this.prisma.lead.findMany({ where: leadWhere, take: 500 }),
      this.prisma.contact.findMany({
        where: {
          organizationId,
          ...(subjectEmail
            ? { email: { equals: subjectEmail, mode: 'insensitive' } }
            : {}),
        },
        take: 500,
      }),
      this.prisma.note.findMany({
        where: {
          organizationId,
          ...(subjectEmail
            ? {
                lead: {
                  email: { equals: subjectEmail, mode: 'insensitive' },
                },
              }
            : {}),
        },
        take: 1000,
      }),
      this.prisma.message.findMany({
        where: {
          organizationId,
          ...(subjectEmail
            ? {
                OR: [
                  {
                    toAddress: {
                      equals: subjectEmail,
                      mode: 'insensitive',
                    },
                  },
                  {
                    fromAddress: {
                      equals: subjectEmail,
                      mode: 'insensitive',
                    },
                  },
                ],
              }
            : {}),
        },
        take: 1000,
      }),
    ]);

    return {
      exportedAt: new Date().toISOString(),
      retentionDays: this.retentionDays(),
      subjectEmail: subjectEmail ?? null,
      leads,
      contacts,
      notes,
      messages,
    };
  }
}
