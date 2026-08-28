import { Injectable, NotFoundException } from '@nestjs/common';
import { ActivityType, Prisma } from '../../../generated/prisma/client';
import { PrismaService } from '../../database/prisma.service';
import {
  CreateLeadDto,
  CreateNoteDto,
  UpdateLeadDto,
} from './dto/leads.dto';

@Injectable()
export class LeadsService {
  constructor(private readonly prisma: PrismaService) {}

  list(
    organizationId: string,
    query?: {
      status?: string;
      search?: string;
      pipelineId?: string;
      pipelineStageId?: string;
    },
  ) {
    const where: Prisma.LeadWhereInput = {
      organizationId,
      deletedAt: null,
      ...(query?.status ? { status: query.status as never } : {}),
      ...(query?.pipelineId ? { pipelineId: query.pipelineId } : {}),
      ...(query?.pipelineStageId
        ? { pipelineStageId: query.pipelineStageId }
        : {}),
      ...(query?.search
        ? {
            OR: [
              { email: { contains: query.search, mode: 'insensitive' } },
              { firstName: { contains: query.search, mode: 'insensitive' } },
              { lastName: { contains: query.search, mode: 'insensitive' } },
              { phone: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    return this.prisma.lead.findMany({
      where,
      orderBy: { updatedAt: 'desc' },
      include: {
        company: { select: { id: true, name: true } },
        owner: { select: { id: true, email: true, firstName: true } },
        pipeline: { select: { id: true, name: true } },
        pipelineStage: { select: { id: true, name: true, position: true } },
        tags: { include: { tag: true } },
      },
      take: 200,
    });
  }

  async get(organizationId: string, id: string) {
    const lead = await this.prisma.lead.findFirst({
      where: { id, organizationId, deletedAt: null },
      include: {
        company: true,
        owner: { select: { id: true, email: true, firstName: true, lastName: true } },
        pipeline: true,
        pipelineStage: true,
        tags: { include: { tag: true } },
        notes: { orderBy: { createdAt: 'desc' }, take: 50 },
        activities: { orderBy: { createdAt: 'desc' }, take: 50 },
        tasks: { orderBy: { dueAt: 'asc' } },
      },
    });
    if (!lead) throw new NotFoundException('Lead not found');
    return lead;
  }

  async create(
    organizationId: string,
    actorUserId: string,
    dto: CreateLeadDto,
  ) {
    const { tagIds, ...data } = dto;

    let pipelineId = data.pipelineId;
    let pipelineStageId = data.pipelineStageId;
    if (!pipelineId || !pipelineStageId) {
      const pipeline = await this.prisma.pipeline.findFirst({
        where: { organizationId },
        orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
        include: { stages: { orderBy: { position: 'asc' }, take: 1 } },
      });
      if (pipeline) {
        pipelineId = pipelineId ?? pipeline.id;
        pipelineStageId = pipelineStageId ?? pipeline.stages[0]?.id;
      }
    }

    const lead = await this.prisma.lead.create({
      data: {
        organizationId,
        ...data,
        pipelineId,
        pipelineStageId,
        ownerId: data.ownerId ?? actorUserId,
        tags: tagIds?.length
          ? {
              create: tagIds.map((tagId) => ({ tagId })),
            }
          : undefined,
      },
      include: {
        pipelineStage: { select: { id: true, name: true } },
        company: { select: { id: true, name: true } },
      },
    });

    await this.prisma.activity.create({
      data: {
        organizationId,
        leadId: lead.id,
        type: ActivityType.lead_created,
        title: 'Lead created',
        actorUserId,
      },
    });

    if (lead.pipelineStageId) {
      await this.prisma.stageHistory.create({
        data: {
          leadId: lead.id,
          stageId: lead.pipelineStageId,
          changedBy: actorUserId,
        },
      });
    }

    return lead;
  }

  async update(
    organizationId: string,
    id: string,
    actorUserId: string,
    dto: UpdateLeadDto,
  ) {
    const existing = await this.get(organizationId, id);
    const { pipelineStageId, pipelineId, ...rest } = dto;
    const data: Prisma.LeadUpdateInput = { ...rest };

    if (pipelineStageId !== undefined) {
      if (pipelineStageId === '' || pipelineStageId === 'unassigned') {
        data.pipelineStage = { disconnect: true };
      } else {
        data.pipelineStage = { connect: { id: pipelineStageId } };
      }
    }
    if (pipelineId !== undefined) {
      if (pipelineId === null || pipelineId === '') {
        data.pipeline = { disconnect: true };
      } else {
        data.pipeline = { connect: { id: pipelineId } };
      }
    }

    const updated = await this.prisma.lead.update({
      where: { id },
      data,
    });

    const nextStageId =
      pipelineStageId === '' || pipelineStageId === 'unassigned'
        ? null
        : (pipelineStageId ?? existing.pipelineStageId);

    if (nextStageId && nextStageId !== existing.pipelineStageId) {
      await this.prisma.stageHistory.create({
        data: {
          leadId: id,
          stageId: nextStageId,
          changedBy: actorUserId,
        },
      });
      await this.prisma.activity.create({
        data: {
          organizationId,
          leadId: id,
          type: ActivityType.stage_changed,
          title: 'Pipeline stage changed',
          actorUserId,
          metadata: {
            from: existing.pipelineStageId,
            to: nextStageId,
          },
        },
      });
    }

    if (dto.ownerId && dto.ownerId !== existing.ownerId) {
      await this.prisma.activity.create({
        data: {
          organizationId,
          leadId: id,
          type: ActivityType.owner_changed,
          title: 'Owner changed',
          actorUserId,
        },
      });
    }

    return updated;
  }

  async remove(organizationId: string, id: string) {
    await this.get(organizationId, id);
    return this.prisma.lead.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }

  async addNote(
    organizationId: string,
    leadId: string,
    actorUserId: string,
    dto: CreateNoteDto,
  ) {
    await this.get(organizationId, leadId);
    const note = await this.prisma.note.create({
      data: {
        organizationId,
        leadId,
        authorId: actorUserId,
        body: dto.body,
      },
    });
    await this.prisma.activity.create({
      data: {
        organizationId,
        leadId,
        type: ActivityType.note_added,
        title: 'Note added',
        actorUserId,
      },
    });
    return note;
  }

  findDuplicates(organizationId: string, email?: string, phone?: string) {
    if (!email && !phone) return [];
    return this.prisma.lead.findMany({
      where: {
        organizationId,
        deletedAt: null,
        OR: [
          ...(email ? [{ email: { equals: email, mode: 'insensitive' as const } }] : []),
          ...(phone ? [{ phone }] : []),
        ],
      },
      take: 20,
    });
  }
}
