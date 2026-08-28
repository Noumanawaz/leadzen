export const FIND_LEADS_COST_CODES = {
  GOOGLE_PLACES_SEARCH: 'google_places_search',
  GOOGLE_PLACES_IMPORT: 'google_places_import',
  APOLLO_SEARCH: 'apollo_search',
  APOLLO_IMPORT: 'apollo_import',
  CSV_IMPORT: 'csv_import',
} as const;

export type FindLeadsCostCode =
  (typeof FIND_LEADS_COST_CODES)[keyof typeof FIND_LEADS_COST_CODES];

export const FIND_LEADS_COST_LABELS: Record<FindLeadsCostCode, string> = {
  google_places_search: 'Google Places search',
  google_places_import: 'Google Places import (per lead)',
  apollo_search: 'Apollo search',
  apollo_import: 'Apollo import (per lead)',
  csv_import: 'CSV import (per lead)',
};

export const DEFAULT_FIND_LEADS_COSTS: Record<FindLeadsCostCode, number> = {
  google_places_search: 2,
  google_places_import: 1,
  apollo_search: 2,
  apollo_import: 1,
  csv_import: 1,
};
