-- CreateEnum
CREATE TYPE "MessageChannel" AS ENUM ('email', 'whatsapp', 'sms', 'phone');

-- CreateEnum
CREATE TYPE "MessageDirection" AS ENUM ('outbound', 'inbound');

-- CreateEnum
CREATE TYPE "MessageStatus" AS ENUM ('queued', 'sending', 'sent', 'delivered', 'opened', 'clicked', 'replied', 'bounced', 'failed', 'ringing', 'in_progress', 'completed', 'no_answer', 'busy');

-- CreateTable
CREATE TABLE "messages" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "connected_account_id" TEXT,
    "lead_id" TEXT,
    "channel" "MessageChannel" NOT NULL,
    "direction" "MessageDirection" NOT NULL,
    "status" "MessageStatus" NOT NULL DEFAULT 'queued',
    "subject" TEXT,
    "body" TEXT,
    "to_address" TEXT,
    "from_address" TEXT,
    "provider_message_id" TEXT,
    "thread_id" TEXT,
    "error" TEXT,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "suppressions" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "reason" TEXT NOT NULL,
    "source" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "suppressions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "messages_organization_id_created_at_idx" ON "messages"("organization_id", "created_at");

-- CreateIndex
CREATE INDEX "messages_organization_id_lead_id_idx" ON "messages"("organization_id", "lead_id");

-- CreateIndex
CREATE INDEX "messages_organization_id_channel_status_idx" ON "messages"("organization_id", "channel", "status");

-- CreateIndex
CREATE INDEX "suppressions_organization_id_email_idx" ON "suppressions"("organization_id", "email");

-- CreateIndex
CREATE INDEX "suppressions_organization_id_phone_idx" ON "suppressions"("organization_id", "phone");

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_connected_account_id_fkey" FOREIGN KEY ("connected_account_id") REFERENCES "connected_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "leads"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "suppressions" ADD CONSTRAINT "suppressions_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
