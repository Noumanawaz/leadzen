import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Groq from 'groq-sdk';
import type { AppEnv } from '../../config/env.validation';
import type {
  AiCompletionInput,
  AiCompletionResult,
  AiProvider,
} from './ai.types';

/** Rough Groq Llama pricing placeholder for ledger recording (USD per 1M tokens). */
const COST_PER_M_INPUT = 0.05;
const COST_PER_M_OUTPUT = 0.08;

@Injectable()
export class GroqProvider implements AiProvider {
  readonly name = 'groq';
  private readonly logger = new Logger(GroqProvider.name);
  private readonly client: Groq | null;
  private readonly model: string;

  constructor(config: ConfigService<AppEnv, true>) {
    const apiKey = config.get('GROQ_API_KEY', { infer: true }) ?? '';
    this.model =
      config.get('GROQ_MODEL', { infer: true }) || 'openai/gpt-oss-20b';
    this.client = apiKey ? new Groq({ apiKey }) : null;
    if (!this.client) {
      this.logger.warn('GROQ_API_KEY unset — GroqProvider will use stub responses');
    }
  }

  async complete(input: AiCompletionInput): Promise<AiCompletionResult> {
    if (!this.client) {
      return this.stub(input);
    }

    const completion = await this.client.chat.completions.create({
      model: this.model,
      temperature: input.temperature ?? 0.4,
      max_tokens: input.maxTokens ?? 1024,
      messages: [
        { role: 'system', content: input.systemPrompt },
        { role: 'user', content: input.userPrompt },
      ],
    });

    const text = completion.choices[0]?.message?.content?.trim() ?? '';
    const inputTokens = completion.usage?.prompt_tokens ?? 0;
    const outputTokens = completion.usage?.completion_tokens ?? 0;
    const providerCost =
      (inputTokens / 1_000_000) * COST_PER_M_INPUT +
      (outputTokens / 1_000_000) * COST_PER_M_OUTPUT;

    return {
      text,
      model: completion.model ?? this.model,
      inputTokens,
      outputTokens,
      providerCost,
    };
  }

  private stub(input: AiCompletionInput): AiCompletionResult {
    const preview = input.userPrompt.slice(0, 120).replace(/\s+/g, ' ');
    const text = `[stub:${input.feature}] Generated without GROQ_API_KEY. Context: ${preview}`;
    return {
      text,
      model: `stub/${this.model}`,
      inputTokens: Math.ceil(input.userPrompt.length / 4),
      outputTokens: Math.ceil(text.length / 4),
      providerCost: 0,
    };
  }
}
