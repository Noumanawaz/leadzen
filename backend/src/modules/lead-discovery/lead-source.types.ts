import type { LeadSourceType } from '../../../generated/prisma/client';

export type DuplicatePolicyName = 'skip' | 'merge' | 'update' | 'create';

export type NormalizedLead = {
  firstName?: string | null;
  lastName?: string | null;
  email?: string | null;
  phone?: string | null;
  jobTitle?: string | null;
  website?: string | null;
  country?: string | null;
  state?: string | null;
  city?: string | null;
  companyName?: string | null;
  companyDomain?: string | null;
  sourceType: LeadSourceType;
  sourceId?: string | null;
  sourceExternalId?: string | null;
  sourceName?: string | null;
  sourceMetadata?: Record<string, unknown> | null;
  leadScoreHint?: number;
};

export type DedupeMatch = {
  leadId: string;
  reason: 'email' | 'phone' | 'external_id' | 'website_name' | 'company_name';
};

export type CommitResult = {
  created: number;
  updated: number;
  skipped: number;
  failed: number;
  creditsUsed: number;
  leadIds: string[];
  errors: Array<{ index: number; message: string }>;
};

export type LeadSearchResult = NormalizedLead & {
  duplicate?: DedupeMatch | null;
};
