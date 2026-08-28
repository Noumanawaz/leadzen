import { Injectable } from '@nestjs/common';
import {
  EnrollmentStatus,
  MessageDirection,
  TaskStatus,
} from '../../../generated/prisma/client';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async stats(organizationId: string) {
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const [
      leadsTotal,
      leadsNewWeek,
      openTasks,
      activeEnrollments,
      messagesOutWeek,
      dealsOpen,
      dealsWon,
      pipeline,
      stageCounts,
      recentActivities,
      creditBalance,
    ] = await Promise.all([
      this.prisma.lead.count({
        where: { organizationId, deletedAt: null },
      }),
      this.prisma.lead.count({
        where: {
          organizationId,
          deletedAt: null,
          createdAt: { gte: weekAgo },
        },
      }),
      this.prisma.task.count({
        where: {
          organizationId,
          status: { not: TaskStatus.completed },
        },
      }),
      this.prisma.sequenceEnrollment.count({
        where: { organizationId, status: EnrollmentStatus.active },
      }),
      this.prisma.message.count({
        where: {
          organizationId,
          direction: MessageDirection.outbound,
          createdAt: { gte: weekAgo },
        },
      }),
      this.prisma.deal.count({
        where: { organizationId, status: 'open' },
      }),
      this.prisma.deal.count({
        where: { organizationId, status: 'won' },
      }),
      this.prisma.pipeline.findFirst({
        where: { organizationId },
        orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
        include: {
          stages: { orderBy: { position: 'asc' } },
        },
      }),
      this.prisma.lead.groupBy({
        by: ['pipelineStageId'],
        where: {
          organizationId,
          deletedAt: null,
          pipelineStageId: { not: null },
        },
        _count: { _all: true },
      }),
      this.prisma.activity.findMany({
        where: { organizationId },
        orderBy: { createdAt: 'desc' },
        take: 12,
        include: {
          lead: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
            },
          },
        },
      }),
      this.prisma.creditAccount.findUnique({
        where: { organizationId },
        select: { balance: true },
      }),
    ]);

    const countByStage = new Map(
      stageCounts.map((row) => [row.pipelineStageId, row._count._all]),
    );

    return {
      leadsTotal,
      leadsNewWeek,
      openTasks,
      activeEnrollments,
      messagesOutWeek,
      dealsOpen,
      dealsWon,
      credits: creditBalance?.balance ?? 0,
      funnel: (pipeline?.stages ?? []).map((s) => ({
        id: s.id,
        name: s.name,
        count: countByStage.get(s.id) ?? 0,
      })),
      recentActivities: recentActivities.map((a) => ({
        id: a.id,
        type: a.type,
        title: a.title,
        createdAt: a.createdAt,
        lead: a.lead,
      })),
    };
  }
}
