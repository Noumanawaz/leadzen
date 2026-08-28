import { Injectable, Logger } from '@nestjs/common';
import {
  EnrollmentStatus,
  SequenceStatus,
  SequenceStepChannel,
} from '../../../generated/prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { OutreachRouter } from '../outreach/outreach.router';
import {
  computeNextRunAt,
  evaluateStepCondition,
} from './sequence.utils';

@Injectable()
export class SequenceRunnerService {
  private readonly logger = new Logger(SequenceRunnerService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly outreach: OutreachRouter,
  ) {}

  /** Process due enrollments (called by interval / BullMQ worker). */
  async processDue(limit = 25): Promise<number> {
    const due = await this.prisma.sequenceEnrollment.findMany({
      where: {
        status: EnrollmentStatus.active,
        nextRunAt: { lte: new Date() },
        sequence: { status: SequenceStatus.active },
      },
      include: {
        currentStep: true,
        lead: true,
        sequence: {
          include: { steps: { orderBy: { position: 'asc' } } },
        },
      },
      take: limit,
      orderBy: { nextRunAt: 'asc' },
    });

    let processed = 0;
    for (const enrollment of due) {
      try {
        await this.runOne(enrollment);
        processed += 1;
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'Sequence step failed';
        this.logger.warn(`Enrollment ${enrollment.id} failed: ${message}`);
        await this.prisma.sequenceEnrollment.update({
          where: { id: enrollment.id },
          data: {
            status: EnrollmentStatus.failed,
            lastError: message,
            nextRunAt: null,
          },
        });
      }
    }
    return processed;
  }

  private async runOne(
    enrollment: Awaited<ReturnType<SequenceRunnerService['loadEnrollment']>>,
  ) {
    if (!enrollment) return;

    if (enrollment.sequence.status !== SequenceStatus.active) {
      await this.prisma.sequenceEnrollment.update({
        where: { id: enrollment.id },
        data: {
          status: EnrollmentStatus.paused,
          stoppedReason: 'sequence_not_active',
          nextRunAt: null,
        },
      });
      return;
    }

    // Stop rules
    if (
      enrollment.lead.status === 'converted' ||
      enrollment.lead.status === 'unqualified'
    ) {
      await this.prisma.sequenceEnrollment.update({
        where: { id: enrollment.id },
        data: {
          status: EnrollmentStatus.stopped,
          stoppedReason: `lead_${enrollment.lead.status}`,
          nextRunAt: null,
        },
      });
      return;
    }

    const suppressed = enrollment.lead.email
      ? await this.prisma.suppression.findFirst({
          where: {
            organizationId: enrollment.organizationId,
            email: {
              equals: enrollment.lead.email,
              mode: 'insensitive',
            },
          },
        })
      : null;
    if (suppressed) {
      await this.prisma.sequenceEnrollment.update({
        where: { id: enrollment.id },
        data: {
          status: EnrollmentStatus.stopped,
          stoppedReason: 'unsubscribed_or_suppressed',
          nextRunAt: null,
        },
      });
      return;
    }

    const step = enrollment.currentStep;
    if (!step) {
      await this.prisma.sequenceEnrollment.update({
        where: { id: enrollment.id },
        data: {
          status: EnrollmentStatus.completed,
          nextRunAt: null,
        },
      });
      return;
    }

    await this.executeStep(enrollment, step);

    const steps = enrollment.sequence.steps;
    const idx = steps.findIndex((s) => s.id === step.id);
    let nextStep = steps[idx + 1] ?? null;

    if (step.condition !== 'none') {
      const passed = evaluateStepCondition({
        condition: step.condition,
        conditionValue: step.conditionValue,
        lead: {
          status: enrollment.lead.status,
          leadScore: enrollment.lead.leadScore,
        },
      });
      const branchId = passed ? step.yesNextStepId : step.noNextStepId;
      if (branchId) {
        nextStep = steps.find((s) => s.id === branchId) ?? nextStep;
      }
    }

    if (!nextStep) {
      await this.prisma.sequenceEnrollment.update({
        where: { id: enrollment.id },
        data: {
          status: EnrollmentStatus.completed,
          currentStepId: null,
          nextRunAt: null,
        },
      });
      return;
    }

    const org = await this.prisma.organization.findUniqueOrThrow({
      where: { id: enrollment.organizationId },
    });
    const nextRunAt = computeNextRunAt({
      from: new Date(),
      delayDays: nextStep.delayDays,
      timezone: org.timezone,
      businessHoursStart: org.businessHoursStart,
      businessHoursEnd: org.businessHoursEnd,
      workingDays: org.workingDays,
    });

    await this.prisma.sequenceEnrollment.update({
      where: { id: enrollment.id },
      data: {
        currentStepId: nextStep.id,
        nextRunAt,
        lastError: null,
      },
    });
  }

  private async loadEnrollment(id: string) {
    return this.prisma.sequenceEnrollment.findUnique({
      where: { id },
      include: {
        currentStep: true,
        lead: true,
        sequence: {
          include: { steps: { orderBy: { position: 'asc' } } },
        },
      },
    });
  }

  private async executeStep(
    enrollment: NonNullable<
      Awaited<ReturnType<SequenceRunnerService['loadEnrollment']>>
    >,
    step: NonNullable<
      NonNullable<
        Awaited<ReturnType<SequenceRunnerService['loadEnrollment']>>
      >['currentStep']
    >,
  ) {
    const lead = enrollment.lead;
    const orgId = enrollment.organizationId;

    switch (step.channel) {
      case SequenceStepChannel.email: {
        if (!lead.email) throw new Error('Lead has no email');
        const account = await this.prisma.connectedAccount.findFirst({
          where: {
            organizationId: orgId,
            provider: 'gmail',
            status: 'active',
          },
        });
        if (!account) throw new Error('No active Gmail account');
        await this.outreach.sendEmail({
          organizationId: orgId,
          userId: lead.ownerId ?? enrollment.leadId,
          connectedAccountId: account.id,
          leadId: lead.id,
          to: lead.email,
          subject: step.subject ?? 'Follow up',
          body: step.body ?? '',
        });
        break;
      }
      case SequenceStepChannel.whatsapp: {
        if (!lead.phone) throw new Error('Lead has no phone');
        await this.outreach.sendWhatsApp({
          organizationId: orgId,
          userId: lead.ownerId ?? enrollment.leadId,
          leadId: lead.id,
          toE164: lead.phone,
          body: step.body ?? '',
        });
        break;
      }
      case SequenceStepChannel.sms: {
        if (!lead.phone) throw new Error('Lead has no phone');
        await this.outreach.sendSms({
          organizationId: orgId,
          userId: lead.ownerId ?? enrollment.leadId,
          leadId: lead.id,
          toE164: lead.phone,
          body: step.body ?? '',
        });
        break;
      }
      case SequenceStepChannel.call: {
        if (!lead.phone) throw new Error('Lead has no phone');
        await this.outreach.placeCall({
          organizationId: orgId,
          userId: lead.ownerId ?? enrollment.leadId,
          leadId: lead.id,
          toE164: lead.phone,
        });
        break;
      }
      case SequenceStepChannel.wait:
      default:
        break;
    }
  }
}
