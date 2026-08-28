-- Phase 8: feature flags + privacy requests

CREATE TABLE "feature_flags" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "description" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "feature_flags_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "feature_flags_key_key" ON "feature_flags"("key");

CREATE TABLE "feature_flag_overrides" (
    "id" TEXT NOT NULL,
    "feature_flag_id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "feature_flag_overrides_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "feature_flag_overrides_feature_flag_id_organization_id_key"
  ON "feature_flag_overrides"("feature_flag_id", "organization_id");
CREATE INDEX "feature_flag_overrides_organization_id_idx"
  ON "feature_flag_overrides"("organization_id");

ALTER TABLE "feature_flag_overrides"
  ADD CONSTRAINT "feature_flag_overrides_feature_flag_id_fkey"
  FOREIGN KEY ("feature_flag_id") REFERENCES "feature_flags"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "feature_flag_overrides"
  ADD CONSTRAINT "feature_flag_overrides_organization_id_fkey"
  FOREIGN KEY ("organization_id") REFERENCES "organizations"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TYPE "PrivacyRequestType" AS ENUM ('export', 'delete');
CREATE TYPE "PrivacyRequestStatus" AS ENUM ('pending', 'processing', 'completed', 'failed');

CREATE TABLE "privacy_requests" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "type" "PrivacyRequestType" NOT NULL,
    "status" "PrivacyRequestStatus" NOT NULL DEFAULT 'pending',
    "subject_email" TEXT,
    "requested_by_user_id" TEXT,
    "result_payload" JSONB,
    "error" TEXT,
    "completed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "privacy_requests_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "privacy_requests_organization_id_status_created_at_idx"
  ON "privacy_requests"("organization_id", "status", "created_at");

ALTER TABLE "privacy_requests"
  ADD CONSTRAINT "privacy_requests_organization_id_fkey"
  FOREIGN KEY ("organization_id") REFERENCES "organizations"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- Seed default flags
INSERT INTO "feature_flags" ("id", "key", "description", "enabled", "updated_at")
VALUES
  ('ff_ai_assist', 'ai_assist', 'Enable AI assist features', true, CURRENT_TIMESTAMP),
  ('ff_sequences', 'sequences', 'Enable sequence automation', true, CURRENT_TIMESTAMP),
  ('ff_calendar', 'calendar_stubs', 'Enable calendar stub endpoints', true, CURRENT_TIMESTAMP);
