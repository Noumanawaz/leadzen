-- CreateEnum
CREATE TYPE "CreditTransactionType" AS ENUM ('subscription_grant', 'purchase', 'usage', 'refund', 'adjustment', 'expiration');

-- CreateEnum
CREATE TYPE "UsageEventType" AS ENUM ('ai_generation', 'ai_enrichment', 'ai_summary', 'email_sent', 'whatsapp_message', 'sms_message', 'call_minute', 'storage');

-- CreateEnum
CREATE TYPE "ConnectedAccountProvider" AS ENUM ('gmail', 'outlook', 'meta_whatsapp', 'sms_placeholder', 'phone_placeholder');

-- CreateEnum
CREATE TYPE "ConnectedAccountStatus" AS ENUM ('active', 'disconnected', 'error', 'pending');

-- CreateTable
CREATE TABLE "plans" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "max_users" INTEGER NOT NULL,
    "max_leads" INTEGER NOT NULL,
    "max_storage_bytes" BIGINT NOT NULL,
    "max_pipelines" INTEGER NOT NULL,
    "max_sequences" INTEGER NOT NULL,
    "max_connected_accounts" INTEGER NOT NULL,
    "included_ai_credits" INTEGER NOT NULL,
    "stripe_price_id" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "credit_accounts" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "balance" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "credit_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "credit_transactions" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "credit_account_id" TEXT NOT NULL,
    "type" "CreditTransactionType" NOT NULL,
    "amount" INTEGER NOT NULL,
    "balance_after" INTEGER NOT NULL,
    "reason" TEXT,
    "metadata" JSONB,
    "created_by_user_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "credit_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "usage_events" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "type" "UsageEventType" NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "unit" TEXT NOT NULL,
    "provider" TEXT,
    "provider_cost" DECIMAL(12,6),
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "usage_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "connected_accounts" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "provider" "ConnectedAccountProvider" NOT NULL,
    "label" TEXT NOT NULL,
    "external_account_id" TEXT,
    "encrypted_credentials" TEXT,
    "status" "ConnectedAccountStatus" NOT NULL DEFAULT 'pending',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "connected_accounts_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "memberships" ADD COLUMN "invite_token" TEXT;
ALTER TABLE "memberships" ADD COLUMN "invite_expires_at" TIMESTAMP(3);

-- CreateIndex
CREATE UNIQUE INDEX "plans_code_key" ON "plans"("code");

-- CreateIndex
CREATE UNIQUE INDEX "credit_accounts_organization_id_key" ON "credit_accounts"("organization_id");

-- CreateIndex
CREATE INDEX "credit_transactions_organization_id_created_at_idx" ON "credit_transactions"("organization_id", "created_at");

-- CreateIndex
CREATE INDEX "credit_transactions_credit_account_id_created_at_idx" ON "credit_transactions"("credit_account_id", "created_at");

-- CreateIndex
CREATE INDEX "usage_events_organization_id_created_at_idx" ON "usage_events"("organization_id", "created_at");

-- CreateIndex
CREATE INDEX "usage_events_organization_id_type_created_at_idx" ON "usage_events"("organization_id", "type", "created_at");

-- CreateIndex
CREATE INDEX "connected_accounts_organization_id_idx" ON "connected_accounts"("organization_id");

-- CreateIndex
CREATE INDEX "connected_accounts_organization_id_provider_idx" ON "connected_accounts"("organization_id", "provider");

-- CreateIndex
CREATE UNIQUE INDEX "memberships_invite_token_key" ON "memberships"("invite_token");

-- CreateIndex
CREATE INDEX "organizations_plan_id_idx" ON "organizations"("plan_id");

-- AddForeignKey
ALTER TABLE "organizations" ADD CONSTRAINT "organizations_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "plans"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credit_accounts" ADD CONSTRAINT "credit_accounts_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credit_transactions" ADD CONSTRAINT "credit_transactions_credit_account_id_fkey" FOREIGN KEY ("credit_account_id") REFERENCES "credit_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "usage_events" ADD CONSTRAINT "usage_events_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "connected_accounts" ADD CONSTRAINT "connected_accounts_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Seed trial plan
INSERT INTO "plans" ("id", "code", "name", "max_users", "max_leads", "max_storage_bytes", "max_pipelines", "max_sequences", "max_connected_accounts", "included_ai_credits", "is_active", "created_at", "updated_at")
VALUES ('plan_trial_default', 'trial', 'Trial', 5, 1000, 1073741824, 3, 3, 2, 500, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
