import { AI_CREDIT_COSTS, usageTypeForFeature } from './ai.types';

describe('ai.types', () => {
  it('maps features to credit costs', () => {
    expect(AI_CREDIT_COSTS.lead_summary).toBe(1);
    expect(AI_CREDIT_COSTS.email_generation).toBe(2);
  });

  it('maps features to usage event types', () => {
    expect(usageTypeForFeature('lead_summary')).toBe('ai_summary');
    expect(usageTypeForFeature('email_generation')).toBe('ai_generation');
    expect(usageTypeForFeature('company_research')).toBe('ai_enrichment');
  });
});
