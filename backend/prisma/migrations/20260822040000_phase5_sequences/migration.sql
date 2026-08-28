-- CreateEnum
CREATE TYPE "SequenceStatus" AS ENUM ('draft', 'active', 'paused', 'archived');

-- CreateEnum
CREATE TYPE "SequenceStepChannel" AS ENUM ('email', 'whatsapp', 'sms', 'call', 'linkedin_task', 'wait');

-- CreateEnum
CREATE TYPE "SequenceCondition" AS ENUM ('none', 'opened', 'clicked', 'replied', 'bounced', 'lead_score_gte', 'status_equals', 'has_tag');

-- CreateEnum
CREATE TYPE "EnrollmentStatus" AS ENUM ('active', 'completed', 'stopped', 'paused', 'failed');

-- CreateEnum
CREATE TYPE "AutomationTrigger" AS ENUM ('lead_created', 'lead_updated', 'lead_stage_changed', 'lead_score_changed', 'email_replied', 'meeting_booked', 'task_completed');

-- AlterTable
ALTER TABLE "organizations" ADD COLUMN     "business_hours_end" INTEGER NOT NULL DEFAULT 17,
ADD COLUMN     "business_hours_start" INTEGER NOT NULL DEFAULT 9,
ADD COLUMN     "working_days" TEXT NOT NULL DEFAULT '1,2,3,4,5';

-- CreateTable
CREATE TABLE "sequences" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" "SequenceStatus" NOT NULL DEFAULT 'draft',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sequences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sequence_steps" (
    "id" TEXT NOT NULL,
    "sequence_id" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "channel" "SequenceStepChannel" NOT NULL,
    "delay_days" INTEGER NOT NULL DEFAULT 0,
    "subject" TEXT,
    "body" TEXT,
    "condition" "SequenceCondition" NOT NULL DEFAULT 'none',
    "condition_value" TEXT,
    "yes_next_step_id" TEXT,
    "no_next_step_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sequence_steps_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sequence_enrollments" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "sequence_id" TEXT NOT NULL,
    "lead_id" TEXT NOT NULL,
    "current_step_id" TEXT,
    "status" "EnrollmentStatus" NOT NULL DEFAULT 'active',
    "next_run_at" TIMESTAMP(3),
    "stopped_reason" TEXT,
    "last_error" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sequence_enrollments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "campaigns" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "sequence_id" TEXT,
    "name" TEXT NOT NULL,
    "sent" INTEGER NOT NULL DEFAULT 0,
    "delivered" INTEGER NOT NULL DEFAULT 0,
    "opened" INTEGER NOT NULL DEFAULT 0,
    "clicked" INTEGER NOT NULL DEFAULT 0,
    "replied" INTEGER NOT NULL DEFAULT 0,
    "bounced" INTEGER NOT NULL DEFAULT 0,
    "unsubscribed" INTEGER NOT NULL DEFAULT 0,
    "meetings" INTEGER NOT NULL DEFAULT 0,
    "won" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "campaigns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "automation_rules" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "trigger" "AutomationTrigger" NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "conditions" JSONB NOT NULL DEFAULT '[]',
    "actions" JSONB NOT NULL DEFAULT '[]',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "automation_rules_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "sequences_organization_id_status_idx" ON "sequences"("organization_id", "status");

-- CreateIndex
CREATE INDEX "sequence_steps_sequence_id_position_idx" ON "sequence_steps"("sequence_id", "position");

-- CreateIndex
CREATE INDEX "sequence_enrollments_organization_id_status_next_run_at_idx" ON "sequence_enrollments"("organization_id", "status", "next_run_at");

-- CreateIndex
CREATE UNIQUE INDEX "sequence_enrollments_sequence_id_lead_id_key" ON "sequence_enrollments"("sequence_id", "lead_id");

-- CreateIndex
CREATE INDEX "campaigns_organization_id_idx" ON "campaigns"("organization_id");

-- CreateIndex
CREATE INDEX "automation_rules_organization_id_trigger_is_active_idx" ON "automation_rules"("organization_id", "trigger", "is_active");

-- AddForeignKey
ALTER TABLE "sequences" ADD CONSTRAINT "sequences_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sequence_steps" ADD CONSTRAINT "sequence_steps_sequence_id_fkey" FOREIGN KEY ("sequence_id") REFERENCES "sequences"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sequence_enrollments" ADD CONSTRAINT "sequence_enrollments_sequence_id_fkey" FOREIGN KEY ("sequence_id") REFERENCES "sequences"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sequence_enrollments" ADD CONSTRAINT "sequence_enrollments_current_step_id_fkey" FOREIGN KEY ("current_step_id") REFERENCES "sequence_steps"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sequence_enrollments" ADD CONSTRAINT "sequence_enrollments_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "leads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "campaigns" ADD CONSTRAINT "campaigns_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "campaigns" ADD CONSTRAINT "campaigns_sequence_id_fkey" FOREIGN KEY ("sequence_id") REFERENCES "sequences"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "automation_rules" ADD CONSTRAINT "automation_rules_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
