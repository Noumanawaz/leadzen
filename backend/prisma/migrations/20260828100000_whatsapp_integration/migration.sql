-- WhatsApp Business Platform integration

ALTER TABLE "connected_accounts" ADD COLUMN IF NOT EXISTS "metadata" JSONB;

CREATE UNIQUE INDEX IF NOT EXISTS "connected_accounts_provider_external_account_id_key"
  ON "connected_accounts"("provider", "external_account_id");

CREATE UNIQUE INDEX IF NOT EXISTS "messages_organization_id_provider_message_id_key"
  ON "messages"("organization_id", "provider_message_id");

CREATE TYPE "WhatsAppWebhookEventStatus" AS ENUM ('pending', 'processed', 'ignored', 'failed');

CREATE TABLE IF NOT EXISTS "whatsapp_templates" (
  "id" TEXT NOT NULL,
  "organization_id" TEXT NOT NULL,
  "connected_account_id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "language" TEXT NOT NULL,
  "category" TEXT,
  "status" TEXT NOT NULL,
  "components" JSONB,
  "external_template_id" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "whatsapp_templates_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "whatsapp_webhook_events" (
  "id" TEXT NOT NULL,
  "external_event_id" TEXT NOT NULL,
  "phone_number_id" TEXT,
  "organization_id" TEXT,
  "event_type" TEXT NOT NULL,
  "payload" JSONB NOT NULL,
  "status" "WhatsAppWebhookEventStatus" NOT NULL DEFAULT 'pending',
  "processed_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "whatsapp_webhook_events_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "whatsapp_templates_connected_account_id_name_language_key"
  ON "whatsapp_templates"("connected_account_id", "name", "language");

CREATE INDEX IF NOT EXISTS "whatsapp_templates_organization_id_idx"
  ON "whatsapp_templates"("organization_id");

CREATE UNIQUE INDEX IF NOT EXISTS "whatsapp_webhook_events_external_event_id_key"
  ON "whatsapp_webhook_events"("external_event_id");

CREATE INDEX IF NOT EXISTS "whatsapp_webhook_events_phone_number_id_idx"
  ON "whatsapp_webhook_events"("phone_number_id");

CREATE INDEX IF NOT EXISTS "whatsapp_webhook_events_organization_id_idx"
  ON "whatsapp_webhook_events"("organization_id");

ALTER TABLE "whatsapp_templates"
  ADD CONSTRAINT "whatsapp_templates_organization_id_fkey"
  FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "whatsapp_templates"
  ADD CONSTRAINT "whatsapp_templates_connected_account_id_fkey"
  FOREIGN KEY ("connected_account_id") REFERENCES "connected_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "whatsapp_webhook_events"
  ADD CONSTRAINT "whatsapp_webhook_events_organization_id_fkey"
  FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
