export type AiFeature =
  | 'lead_summary'
  | 'email_generation'
  | 'reply_generation'
  | 'lead_scoring'
  | 'company_research'
  | 'call_summary';

export type AiCompletionInput = {
  feature: AiFeature;
  systemPrompt: string;
  userPrompt: string;
  temperature?: number;
  maxTokens?: number;
};

export type AiCompletionResult = {
  text: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  /** Estimated USD provider cost (best-effort). */
  providerCost: number;
};

export interface AiProvider {
  readonly name: string;
  complete(input: AiCompletionInput): Promise<AiCompletionResult>;
}

export const AI_PROVIDER = Symbol('AI_PROVIDER');

export const AI_CREDIT_COSTS: Record<AiFeature, number> = {
  lead_summary: 1,
  email_generation: 2,
  reply_generation: 2,
  lead_scoring: 1,
  company_research: 2,
  call_summary: 1,
};

export function usageTypeForFeature(
  feature: AiFeature,
): 'ai_summary' | 'ai_generation' | 'ai_enrichment' {
  if (feature === 'lead_summary' || feature === 'call_summary') {
    return 'ai_summary';
  }
  if (feature === 'company_research' || feature === 'lead_scoring') {
    return 'ai_enrichment';
  }
  return 'ai_generation';
}
