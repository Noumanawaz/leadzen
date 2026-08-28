import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { UsageEventType } from '../../../generated/prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { CreditService } from '../credits/credit.service';
import { UsageService } from '../usage/usage.service';
import {
  AI_CREDIT_COSTS,
  AI_PROVIDER,
  type AiFeature,
  type AiProvider,
  usageTypeForFeature,
} from './ai.types';

@Injectable()
export class AiService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly credits: CreditService,
    private readonly usage: UsageService,
    @Inject(AI_PROVIDER) private readonly provider: AiProvider,
  ) {}

  async summarizeLead(params: {
    organizationId: string;
    userId: string;
    leadId: string;
  }) {
    const lead = await this.loadLead(params.organizationId, params.leadId);
    const notes = lead.notes
      .slice(0, 8)
      .map((n) => `- ${n.body}`)
      .join('\n');
    const activities = lead.activities
      .slice(0, 8)
      .map((a) => `- ${a.type}: ${a.title}`)
      .join('\n');

    return this.run({
      organizationId: params.organizationId,
      userId: params.userId,
      feature: 'lead_summary',
      systemPrompt:
        'You are a B2B sales assistant. Summarize the lead for an AE in 4-6 bullet points. Be concrete and concise.',
      userPrompt: [
        `Name: ${[lead.firstName, lead.lastName].filter(Boolean).join(' ') || 'Unknown'}`,
        `Email: ${lead.email ?? 'n/a'}`,
        `Company: ${lead.company?.name ?? 'n/a'}`,
        `Status: ${lead.status}`,
        `Score: ${lead.leadScore}`,
        `Stage: ${lead.pipelineStage?.name ?? 'n/a'}`,
        `Notes:\n${notes || '(none)'}`,
        `Recent activity:\n${activities || '(none)'}`,
      ].join('\n'),
      metadata: { leadId: lead.id },
    });
  }

  async generateEmail(params: {
    organizationId: string;
    userId: string;
    leadId: string;
    goal?: string;
    tone?: string;
  }) {
    const lead = await this.loadLead(params.organizationId, params.leadId);
    return this.run({
      organizationId: params.organizationId,
      userId: params.userId,
      feature: 'email_generation',
      systemPrompt:
        'Write a short outbound sales email. Return JSON with keys subject and body only. No markdown.',
      userPrompt: [
        `Lead: ${[lead.firstName, lead.lastName].filter(Boolean).join(' ') || 'there'}`,
        `Company: ${lead.company?.name ?? 'their company'}`,
        `Goal: ${params.goal ?? 'book a 15-minute intro call'}`,
        `Tone: ${params.tone ?? 'professional and concise'}`,
      ].join('\n'),
      metadata: { leadId: lead.id, goal: params.goal, tone: params.tone },
    });
  }

  async generateReply(params: {
    organizationId: string;
    userId: string;
    leadId: string;
    inboundMessage: string;
  }) {
    const lead = await this.loadLead(params.organizationId, params.leadId);
    return this.run({
      organizationId: params.organizationId,
      userId: params.userId,
      feature: 'reply_generation',
      systemPrompt:
        'Draft a helpful sales reply. Keep it under 180 words. Return plain text only.',
      userPrompt: [
        `Lead: ${[lead.firstName, lead.lastName].filter(Boolean).join(' ') || 'there'}`,
        `Inbound message:\n${params.inboundMessage}`,
      ].join('\n'),
      metadata: { leadId: lead.id },
    });
  }

  async scoreLead(params: {
    organizationId: string;
    userId: string;
    leadId: string;
  }) {
    const lead = await this.loadLead(params.organizationId, params.leadId);
    const result = await this.run({
      organizationId: params.organizationId,
      userId: params.userId,
      feature: 'lead_scoring',
      systemPrompt:
        'Score this B2B lead from 0-100. Return JSON only: {"score":number,"rationale":string}.',
      userPrompt: [
        `Email: ${lead.email ?? 'n/a'}`,
        `Title/role signals: ${lead.jobTitle ?? 'n/a'}`,
        `Company: ${lead.company?.name ?? 'n/a'} (${lead.company?.industry ?? 'unknown industry'})`,
        `Status: ${lead.status}`,
        `Existing score: ${lead.leadScore}`,
      ].join('\n'),
      metadata: { leadId: lead.id },
    });

    const parsed = this.tryParseScore(result.text);
    if (parsed != null) {
      await this.prisma.lead.update({
        where: { id: lead.id },
        data: { leadScore: parsed },
      });
      return { ...result, score: parsed };
    }
    return { ...result, score: null as number | null };
  }

  async researchCompany(params: {
    organizationId: string;
    userId: string;
    companyId?: string;
    companyName?: string;
  }) {
    let companyName = params.companyName?.trim();
    let industry: string | undefined;
    let website: string | undefined;

    if (params.companyId) {
      const company = await this.prisma.company.findFirst({
        where: {
          id: params.companyId,
          organizationId: params.organizationId,
          deletedAt: null,
        },
      });
      if (!company) throw new NotFoundException('Company not found');
      companyName = company.name;
      industry = company.industry ?? undefined;
      website = company.website ?? undefined;
    }

    if (!companyName) {
      throw new BadRequestException('companyId or companyName is required');
    }

    return this.run({
      organizationId: params.organizationId,
      userId: params.userId,
      feature: 'company_research',
      systemPrompt:
        'Provide a brief company research brief for sales. Cover what they do, likely pain points, and 3 outreach angles. Mark uncertain facts clearly. This is a stub-quality research brief without live web search.',
      userPrompt: [
        `Company: ${companyName}`,
        `Industry: ${industry ?? 'unknown'}`,
        `Website: ${website ?? 'unknown'}`,
      ].join('\n'),
      metadata: {
        companyId: params.companyId,
        companyName,
      },
    });
  }

  async summarizeCall(params: {
    organizationId: string;
    userId: string;
    leadId?: string;
    transcript: string;
  }) {
    if (params.leadId) {
      await this.loadLead(params.organizationId, params.leadId);
    }
    return this.run({
      organizationId: params.organizationId,
      userId: params.userId,
      feature: 'call_summary',
      systemPrompt:
        'Summarize this sales call transcript into: summary, objections, next steps. Use short bullets.',
      userPrompt: params.transcript,
      metadata: { leadId: params.leadId },
    });
  }

  listRecent(organizationId: string, take = 30) {
    return this.prisma.aiRequest.findMany({
      where: { organizationId },
      orderBy: { createdAt: 'desc' },
      take,
      select: {
        id: true,
        feature: true,
        provider: true,
        model: true,
        inputTokens: true,
        outputTokens: true,
        providerCost: true,
        creditsUsed: true,
        createdAt: true,
      },
    });
  }

  private async run(params: {
    organizationId: string;
    userId: string;
    feature: AiFeature;
    systemPrompt: string;
    userPrompt: string;
    metadata?: Record<string, unknown>;
  }) {
    const creditsUsed = AI_CREDIT_COSTS[params.feature];
    const overageAllowed = await this.isOverageAllowed(params.organizationId);

    if (!overageAllowed) {
      const balance = await this.credits.getBalance(params.organizationId);
      if (balance < creditsUsed) {
        throw new BadRequestException('Insufficient credits');
      }
    }

    let completion;
    try {
      completion = await this.provider.complete({
        feature: params.feature,
        systemPrompt: params.systemPrompt,
        userPrompt: params.userPrompt,
      });
    } catch (err) {
      throw new ServiceUnavailableException(
        err instanceof Error ? err.message : 'AI provider failed',
      );
    }

    await this.credits.debit({
      organizationId: params.organizationId,
      amount: creditsUsed,
      reason: `ai:${params.feature}`,
      createdByUserId: params.userId,
      metadata: {
        feature: params.feature,
        model: completion.model,
        inputTokens: completion.inputTokens,
        outputTokens: completion.outputTokens,
      },
    });

    await this.usage.record({
      organizationId: params.organizationId,
      type: usageTypeForFeature(params.feature) as UsageEventType,
      quantity: 1,
      unit: 'request',
      provider: this.provider.name,
      providerCost: completion.providerCost,
      metadata: {
        feature: params.feature,
        model: completion.model,
        inputTokens: completion.inputTokens,
        outputTokens: completion.outputTokens,
      },
    });

    const record = await this.prisma.aiRequest.create({
      data: {
        organizationId: params.organizationId,
        userId: params.userId,
        feature: params.feature,
        provider: this.provider.name,
        model: completion.model,
        inputTokens: completion.inputTokens,
        outputTokens: completion.outputTokens,
        providerCost: completion.providerCost,
        creditsUsed,
        prompt: params.userPrompt.slice(0, 4000),
        response: completion.text.slice(0, 8000),
        metadata: params.metadata as never,
      },
    });

    return {
      id: record.id,
      feature: params.feature,
      text: completion.text,
      model: completion.model,
      inputTokens: completion.inputTokens,
      outputTokens: completion.outputTokens,
      providerCost: completion.providerCost,
      creditsUsed,
    };
  }

  private async isOverageAllowed(organizationId: string): Promise<boolean> {
    // Reserved for plan/org overage flags. Hard-stop by default.
    void organizationId;
    return false;
  }

  private async loadLead(organizationId: string, leadId: string) {
    const lead = await this.prisma.lead.findFirst({
      where: { id: leadId, organizationId, deletedAt: null },
      include: {
        company: true,
        pipelineStage: { select: { name: true } },
        notes: { orderBy: { createdAt: 'desc' }, take: 10 },
        activities: { orderBy: { createdAt: 'desc' }, take: 10 },
      },
    });
    if (!lead) throw new NotFoundException('Lead not found');
    return lead;
  }

  private tryParseScore(text: string): number | null {
    try {
      const jsonStart = text.indexOf('{');
      const jsonEnd = text.lastIndexOf('}');
      if (jsonStart < 0 || jsonEnd < 0) return null;
      const parsed = JSON.parse(text.slice(jsonStart, jsonEnd + 1)) as {
        score?: unknown;
      };
      const score = Number(parsed.score);
      if (!Number.isFinite(score)) return null;
      return Math.max(0, Math.min(100, Math.round(score)));
    } catch {
      return null;
    }
  }
}
