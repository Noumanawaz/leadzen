import { Injectable, NotFoundException } from '@nestjs/common';
import {
  ActivityType,
  DealStatus,
  TaskPriority,
  TaskStatus,
  TaskType,
} from '../../../generated/prisma/client';
import { PrismaService } from '../../database/prisma.service';
import {
  CreateDealDto,
  CreatePipelineDto,
  CreateTaskDto,
} from './dto/pipelines.dto';

const DEFAULT_STAGES = [
  'New',
  'Contacted',
  'Qualified',
  'Meeting',
  'Proposal',
  'Negotiation',
  'Won',
  'Lost',
];

@Injectable()
export class PipelinesService {
  constructor(private readonly prisma: PrismaService) {}

  list(organizationId: string) {
    return this.prisma.pipeline.findMany({
      where: { organizationId },
      include: { stages: { orderBy: { position: 'asc' } } },
      orderBy: { createdAt: 'asc' },
    });
  }

  async ensureDefault(organizationId: string) {
    const existing = await this.prisma.pipeline.findFirst({
      where: { organizationId },
      include: { stages: { orderBy: { position: 'asc' } } },
    });
    if (existing) return existing;
    return this.create(organizationId, {
      name: 'Outbound',
      isDefault: true,
      stages: DEFAULT_STAGES.map((name) => ({ name })),
    });
  }

  create(organizationId: string, dto: CreatePipelineDto) {
    return this.prisma.pipeline.create({
      data: {
        organizationId,
        name: dto.name,
        isDefault: dto.isDefault ?? false,
        stages: {
          create: dto.stages.map((stage, index) => ({
            name: stage.name,
            color: stage.color,
            position: index,
          })),
        },
      },
      include: { stages: { orderBy: { position: 'asc' } } },
    });
  }

  listDeals(organizationId: string) {
    return this.prisma.deal.findMany({
      where: { organizationId },
      include: {
        stage: true,
        pipeline: true,
        lead: { select: { id: true, firstName: true, lastName: true, email: true } },
        company: { select: { id: true, name: true } },
      },
      orderBy: { updatedAt: 'desc' },
    });
  }

  createDeal(organizationId: string, actorUserId: string, dto: CreateDealDto) {
    return this.prisma.deal.create({
      data: {
        organizationId,
        name: dto.name,
        pipelineId: dto.pipelineId,
        stageId: dto.stageId,
        leadId: dto.leadId,
        companyId: dto.companyId,
        value: dto.value ?? 0,
        currency: dto.currency ?? 'USD',
        probability: dto.probability ?? 0,
        ownerId: dto.ownerId ?? actorUserId,
      },
    });
  }

  async updateDealStatus(
    organizationId: string,
    id: string,
    status: 'open' | 'won' | 'lost',
  ) {
    const deal = await this.prisma.deal.findFirst({
      where: { id, organizationId },
    });
    if (!deal) throw new NotFoundException('Deal not found');
    return this.prisma.deal.update({
      where: { id },
      data: { status: status as DealStatus },
    });
  }

  listTasks(organizationId: string) {
    return this.prisma.task.findMany({
      where: { organizationId },
      include: {
        lead: { select: { id: true, firstName: true, lastName: true, email: true } },
        assignee: { select: { id: true, email: true, firstName: true } },
      },
      orderBy: [{ status: 'asc' }, { dueAt: 'asc' }],
    });
  }

  async createTask(
    organizationId: string,
    actorUserId: string,
    dto: CreateTaskDto,
  ) {
    const task = await this.prisma.task.create({
      data: {
        organizationId,
        title: dto.title,
        leadId: dto.leadId,
        assignedTo: dto.assignedTo ?? actorUserId,
        type: (dto.type as TaskType) ?? TaskType.follow_up,
        description: dto.description,
        dueAt: dto.dueAt ? new Date(dto.dueAt) : undefined,
        priority: (dto.priority as TaskPriority) ?? TaskPriority.medium,
      },
    });

    if (dto.leadId) {
      await this.prisma.activity.create({
        data: {
          organizationId,
          leadId: dto.leadId,
          type: ActivityType.task_created,
          title: `Task: ${dto.title}`,
          actorUserId,
        },
      });
    }

    return task;
  }

  async completeTask(organizationId: string, id: string) {
    const task = await this.prisma.task.findFirst({
      where: { id, organizationId },
    });
    if (!task) throw new NotFoundException('Task not found');
    return this.prisma.task.update({
      where: { id },
      data: { status: TaskStatus.completed, completedAt: new Date() },
    });
  }
}
