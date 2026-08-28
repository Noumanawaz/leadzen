import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  EnrollmentStatus,
  SequenceStatus,
  SequenceStepChannel,
} from '../../../generated/prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { computeNextRunAt } from './sequence.utils';

export type CreateSequenceInput = {
  name: string;
  steps: Array<{
    channel: SequenceStepChannel;
    delayDays?: number;
    subject?: string;
    body?: string;
    condition?: string;
    conditionValue?: string;
  }>;
};

@Injectable()
export class SequencesService {
  constructor(private readonly prisma: PrismaService) {}

  list(organizationId: string) {
    return this.prisma.sequence.findMany({
      where: { organizationId },
      include: {
        steps: { orderBy: { position: 'asc' } },
        _count: { select: { enrollments: true } },
      },
      orderBy: { updatedAt: 'desc' },
    });
  }

  async get(organizationId: string, id: string) {
    const sequence = await this.prisma.sequence.findFirst({
      where: { id, organizationId },
      include: {
        steps: { orderBy: { position: 'asc' } },
        enrollments: {
          take: 50,
          orderBy: { updatedAt: 'desc' },
          include: {
            lead: {
              select: {
                id: true,
                email: true,
                phone: true,
                firstName: true,
                lastName: true,
              },
            },
            currentStep: {
              select: {
                id: true,
                channel: true,
                position: true,
                subject: true,
                delayDays: true,
              },
            },
          },
        },
      },
    });
    if (!sequence) throw new NotFoundException('Sequence not found');
    return sequence;
  }

  async create(organizationId: string, input: CreateSequenceInput) {
    if (!input.steps?.length) {
      throw new BadRequestException('At least one step is required');
    }
    return this.prisma.sequence.create({
      data: {
        organizationId,
        name: input.name,
        status: SequenceStatus.draft,
        steps: {
          create: input.steps.map((step, index) => ({
            position: index,
            channel: step.channel,
            delayDays: step.delayDays ?? 0,
            subject: step.subject,
            body: step.body,
            condition: 'none',
            conditionValue: null,
          })),
        },
      },
      include: { steps: { orderBy: { position: 'asc' } } },
    });
  }

  async activate(organizationId: string, id: string) {
    const sequence = await this.get(organizationId, id);
    if (!sequence.steps.length) {
      throw new BadRequestException('Add at least one step before activating');
    }
    return this.prisma.sequence.update({
      where: { id },
      data: { status: SequenceStatus.active },
    });
  }

  async pause(organizationId: string, id: string) {
    await this.get(organizationId, id);
    return this.prisma.sequence.update({
      where: { id },
      data: { status: SequenceStatus.paused },
    });
  }

  async archive(organizationId: string, id: string) {
    await this.get(organizationId, id);
    await this.prisma.sequenceEnrollment.updateMany({
      where: {
        organizationId,
        sequenceId: id,
        status: EnrollmentStatus.active,
      },
      data: {
        status: EnrollmentStatus.stopped,
        stoppedReason: 'sequence_archived',
        nextRunAt: null,
      },
    });
    return this.prisma.sequence.update({
      where: { id },
      data: { status: SequenceStatus.archived },
    });
  }

  async enroll(
    organizationId: string,
    sequenceId: string,
    leadId: string,
  ) {
    const sequence = await this.get(organizationId, sequenceId);
    if (sequence.status !== SequenceStatus.active) {
      throw new BadRequestException('Sequence must be active to enroll leads');
    }
    const lead = await this.prisma.lead.findFirst({
      where: { id: leadId, organizationId, deletedAt: null },
    });
    if (!lead) throw new NotFoundException('Lead not found');

    const firstStep = sequence.steps[0];
    if (!firstStep) {
      throw new BadRequestException('Sequence has no steps');
    }

    if (firstStep.channel === SequenceStepChannel.email && !lead.email) {
      throw new BadRequestException(
        'Lead has no email — required for the first email step',
      );
    }
    if (
      (firstStep.channel === SequenceStepChannel.whatsapp ||
        firstStep.channel === SequenceStepChannel.sms ||
        firstStep.channel === SequenceStepChannel.call) &&
      !lead.phone
    ) {
      throw new BadRequestException(
        'Lead has no phone — required for the first messaging/call step',
      );
    }

    const org = await this.prisma.organization.findUniqueOrThrow({
      where: { id: organizationId },
    });

    const nextRunAt = computeNextRunAt({
      from: new Date(),
      delayDays: firstStep.delayDays ?? 0,
      timezone: org.timezone,
      businessHoursStart: org.businessHoursStart,
      businessHoursEnd: org.businessHoursEnd,
      workingDays: org.workingDays,
    });

    return this.prisma.sequenceEnrollment.upsert({
      where: {
        sequenceId_leadId: { sequenceId, leadId },
      },
      create: {
        organizationId,
        sequenceId,
        leadId,
        currentStepId: firstStep.id,
        status: EnrollmentStatus.active,
        nextRunAt,
      },
      update: {
        status: EnrollmentStatus.active,
        currentStepId: firstStep.id,
        nextRunAt,
        stoppedReason: null,
        lastError: null,
      },
    });
  }

  async stopEnrollment(
    organizationId: string,
    enrollmentId: string,
    reason: string,
  ) {
    const enrollment = await this.prisma.sequenceEnrollment.findFirst({
      where: { id: enrollmentId, organizationId },
    });
    if (!enrollment) throw new NotFoundException('Enrollment not found');
    return this.prisma.sequenceEnrollment.update({
      where: { id: enrollmentId },
      data: {
        status: EnrollmentStatus.stopped,
        stoppedReason: reason,
        nextRunAt: null,
      },
    });
  }
}
