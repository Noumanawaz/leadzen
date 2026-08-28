-- Additional Find Leads credit costs
INSERT INTO "credit_cost_configs" ("id", "code", "credits", "description", "updated_at") VALUES
  ('ccfg_places_search', 'google_places_search', 2, 'Platform credits per Google Places search', CURRENT_TIMESTAMP),
  ('ccfg_apollo_search', 'apollo_search', 2, 'Platform credits per Apollo search', CURRENT_TIMESTAMP),
  ('ccfg_csv_import', 'csv_import', 1, 'Platform credits per CSV lead imported', CURRENT_TIMESTAMP)
ON CONFLICT ("code") DO NOTHING;
