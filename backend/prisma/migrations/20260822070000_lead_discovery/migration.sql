-- AlterEnum ConnectedAccountProvider
ALTER TYPE "ConnectedAccountProvider" ADD VALUE 'apollo';
ALTER TYPE "ConnectedAccountProvider" ADD VALUE 'google_places';

-- CreateEnum
CREATE TYPE "LeadSourceType" AS ENUM ('apollo', 'google_places', 'csv', 'website_form', 'referral', 'api', 'manual', 'other');
CREATE TYPE "LeadSourceStatus" AS ENUM ('active', 'paused', 'archived');
CREATE TYPE "LeadImportStatus" AS ENUM ('pending', 'mapping', 'queued', 'processing', 'completed', 'failed', 'cancelled');
CREATE TYPE "DuplicatePolicy" AS ENUM ('skip', 'merge', 'update', 'create');

-- AlterTable leads
ALTER TABLE "leads" ADD COLUMN "source_type" "LeadSourceType",
ADD COLUMN "source_id" TEXT,
ADD COLUMN "source_external_id" TEXT,
ADD COLUMN "source_name" TEXT,
ADD COLUMN "source_metadata" JSONB;

CREATE INDEX "leads_organization_id_source_type_source_external_id_idx" ON "leads"("organization_id", "source_type", "source_external_id");

-- Tables
CREATE TABLE "lead_sources" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "type" "LeadSourceType" NOT NULL,
    "name" TEXT NOT NULL,
    "integration_id" TEXT,
    "configuration" JSONB NOT NULL DEFAULT '{}',
    "status" "LeadSourceStatus" NOT NULL DEFAULT 'active',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "lead_sources_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "lead_imports" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "status" "LeadImportStatus" NOT NULL DEFAULT 'pending',
    "mapping" JSONB,
    "duplicate_policy" "DuplicatePolicy" NOT NULL DEFAULT 'skip',
    "total_rows" INTEGER NOT NULL DEFAULT 0,
    "valid_rows" INTEGER NOT NULL DEFAULT 0,
    "imported_rows" INTEGER NOT NULL DEFAULT 0,
    "skipped_rows" INTEGER NOT NULL DEFAULT 0,
    "failed_rows" INTEGER NOT NULL DEFAULT 0,
    "error_report" JSONB,
    "raw_preview" JSONB,
    "headers" JSONB,
    "created_by_user_id" TEXT,
    "started_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "lead_imports_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "lead_forms" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "public_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "fields" JSONB NOT NULL DEFAULT '[]',
    "automation" JSONB NOT NULL DEFAULT '{}',
    "spam_settings" JSONB NOT NULL DEFAULT '{}',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "submission_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "lead_forms_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "lead_form_submissions" (
    "id" TEXT NOT NULL,
    "lead_form_id" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "lead_id" TEXT,
    "ip_hash" TEXT,
    "user_agent" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lead_form_submissions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "referral_links" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT,
    "campaign_meta" JSONB NOT NULL DEFAULT '{}',
    "pipeline_id" TEXT,
    "sequence_id" TEXT,
    "click_count" INTEGER NOT NULL DEFAULT 0,
    "lead_count" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "referral_links_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "organization_api_keys" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "key_prefix" TEXT NOT NULL,
    "key_hash" TEXT NOT NULL,
    "scopes" JSONB NOT NULL DEFAULT '["leads:write"]',
    "last_used_at" TIMESTAMP(3),
    "revoked_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "organization_api_keys_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "inbound_webhook_endpoints" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "public_id" TEXT NOT NULL,
    "secret_hash" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "inbound_webhook_endpoints_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "credit_cost_configs" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "credits" INTEGER NOT NULL,
    "description" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "credit_cost_configs_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "provider_usage_events" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "provider_cost" DOUBLE PRECISION,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "provider_usage_events_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "lead_forms_public_id_key" ON "lead_forms"("public_id");
CREATE UNIQUE INDEX "referral_links_organization_id_code_key" ON "referral_links"("organization_id", "code");
CREATE UNIQUE INDEX "organization_api_keys_key_hash_key" ON "organization_api_keys"("key_hash");
CREATE UNIQUE INDEX "inbound_webhook_endpoints_public_id_key" ON "inbound_webhook_endpoints"("public_id");
CREATE UNIQUE INDEX "credit_cost_configs_code_key" ON "credit_cost_configs"("code");

CREATE INDEX "lead_sources_organization_id_type_idx" ON "lead_sources"("organization_id", "type");
CREATE INDEX "lead_imports_organization_id_created_at_idx" ON "lead_imports"("organization_id", "created_at");
CREATE INDEX "lead_imports_organization_id_status_idx" ON "lead_imports"("organization_id", "status");
CREATE INDEX "lead_forms_organization_id_idx" ON "lead_forms"("organization_id");
CREATE INDEX "lead_form_submissions_lead_form_id_created_at_idx" ON "lead_form_submissions"("lead_form_id", "created_at");
CREATE INDEX "referral_links_code_idx" ON "referral_links"("code");
CREATE INDEX "organization_api_keys_organization_id_idx" ON "organization_api_keys"("organization_id");
CREATE INDEX "inbound_webhook_endpoints_organization_id_idx" ON "inbound_webhook_endpoints"("organization_id");
CREATE INDEX "provider_usage_events_organization_id_provider_created_at_idx" ON "provider_usage_events"("organization_id", "provider", "created_at");

ALTER TABLE "lead_sources" ADD CONSTRAINT "lead_sources_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "lead_imports" ADD CONSTRAINT "lead_imports_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "lead_forms" ADD CONSTRAINT "lead_forms_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "lead_form_submissions" ADD CONSTRAINT "lead_form_submissions_lead_form_id_fkey" FOREIGN KEY ("lead_form_id") REFERENCES "lead_forms"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "referral_links" ADD CONSTRAINT "referral_links_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "organization_api_keys" ADD CONSTRAINT "organization_api_keys_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "inbound_webhook_endpoints" ADD CONSTRAINT "inbound_webhook_endpoints_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "provider_usage_events" ADD CONSTRAINT "provider_usage_events_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Seed platform credit costs
INSERT INTO "credit_cost_configs" ("id", "code", "credits", "description", "updated_at") VALUES
  ('ccfg_apollo_import', 'apollo_import', 1, 'Platform credits per Apollo lead imported', CURRENT_TIMESTAMP),
  ('ccfg_places_import', 'google_places_import', 1, 'Platform credits per Google Places lead imported', CURRENT_TIMESTAMP),
  ('ccfg_email_verify', 'email_verify', 1, 'Platform credits per email verification', CURRENT_TIMESTAMP),
  ('ccfg_enrichment', 'enrichment', 2, 'Platform credits per enrichment', CURRENT_TIMESTAMP),
  ('ccfg_ai_qualify', 'ai_qualification', 3, 'Platform credits per AI qualification', CURRENT_TIMESTAMP);
