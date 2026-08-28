jest.mock('../../database/prisma.service', () => ({
  PrismaService: class PrismaService {},
}));

jest.mock('../../../generated/prisma/client', () => ({
  UsageEventType: {
    ai_generation: 'ai_generation',
    ai_enrichment: 'ai_enrichment',
    ai_summary: 'ai_summary',
  },
  PrismaClient: class PrismaClient {},
}));

import { BadRequestException } from '@nestjs/common';
import { AiService } from './ai.service';
import type { AiProvider } from './ai.types';

describe('AiService', () => {
  const organizationId = 'org_1';
  const userId = 'user_1';
  const leadId = 'lead_1';

  const provider: AiProvider = {
    name: 'test',
    complete: jest.fn(async () => ({
      text: '{"score":72,"rationale":"Strong fit"}',
      model: 'test-model',
      inputTokens: 10,
      outputTokens: 20,
      providerCost: 0.001,
    })),
  };

  const credits = {
    getBalance: jest.fn(async () => 10),
    debit: jest.fn(async () => ({})),
  };

  const usage = {
    record: jest.fn(async () => ({})),
  };

  const prisma = {
    lead: {
      findFirst: jest.fn(),
      update: jest.fn(),
    },
    company: {
      findFirst: jest.fn(),
    },
    organization: {
      findUnique: jest.fn(),
    },
    aiRequest: {
      create: jest.fn(async ({ data }: { data: Record<string, unknown> }) => ({
        id: 'ai_req_1',
        ...data,
      })),
      findMany: jest.fn(),
    },
  };

  let service: AiService;

  beforeEach(() => {
    jest.clearAllMocks();
    credits.getBalance.mockResolvedValue(10);
    prisma.lead.findFirst.mockResolvedValue({
      id: leadId,
      firstName: 'Ada',
      lastName: 'Lovelace',
      email: 'ada@example.com',
      jobTitle: 'VP Eng',
      status: 'new',
      leadScore: 40,
      company: { name: 'Analytical Engines', industry: 'Software' },
      pipelineStage: { name: 'Qualified' },
      notes: [{ body: 'Interested in automation' }],
      activities: [{ type: 'email_sent', title: 'Intro' }],
    });
    prisma.aiRequest.create.mockImplementation(
      async ({ data }: { data: Record<string, unknown> }) => ({
        id: 'ai_req_1',
        ...data,
      }),
    );
    service = new AiService(
      prisma as never,
      credits as never,
      usage as never,
      provider,
    );
  });

  it('summarizes a lead and records credits/usage', async () => {
    const result = await service.summarizeLead({
      organizationId,
      userId,
      leadId,
    });

    expect(result.feature).toBe('lead_summary');
    expect(result.creditsUsed).toBe(1);
    expect(credits.debit).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId,
        amount: 1,
        reason: 'ai:lead_summary',
      }),
    );
    expect(usage.record).toHaveBeenCalled();
    expect(prisma.aiRequest.create).toHaveBeenCalled();
  });

  it('hard-stops when credits are insufficient', async () => {
    credits.getBalance.mockResolvedValue(0);
    await expect(
      service.summarizeLead({ organizationId, userId, leadId }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(provider.complete).not.toHaveBeenCalled();
    expect(credits.debit).not.toHaveBeenCalled();
  });

  it('parses score and updates lead', async () => {
    const result = await service.scoreLead({
      organizationId,
      userId,
      leadId,
    });
    expect(result.score).toBe(72);
    expect(prisma.lead.update).toHaveBeenCalledWith({
      where: { id: leadId },
      data: { leadScore: 72 },
    });
  });
});
