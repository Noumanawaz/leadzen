import { Injectable } from '@nestjs/common';
import type { NormalizedLead } from './lead-source.types';

@Injectable()
export class LeadScoringService {
  score(lead: NormalizedLead): number {
    let score = lead.leadScoreHint ?? 0;
    if (lead.email) score += 25;
    if (lead.phone) score += 20;
    if (lead.companyName || lead.companyDomain) score += 15;
    if (lead.jobTitle) score += 10;
    if (lead.website) score += 5;
    if (lead.city || lead.country) score += 5;
    if (lead.sourceType === 'apollo' || lead.sourceType === 'google_places') {
      score += 10;
    }
    return Math.min(100, Math.max(0, score));
  }
}
