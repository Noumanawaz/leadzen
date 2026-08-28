-- Remove LinkedIn from app enums (migrate existing rows first)

-- Sequence steps
UPDATE "sequence_steps" SET "channel" = 'wait' WHERE "channel"::text = 'linkedin_task';

ALTER TYPE "SequenceStepChannel" RENAME TO "SequenceStepChannel_old";
CREATE TYPE "SequenceStepChannel" AS ENUM ('email', 'whatsapp', 'sms', 'call', 'wait');
ALTER TABLE "sequence_steps"
  ALTER COLUMN "channel" TYPE "SequenceStepChannel"
  USING ("channel"::text::"SequenceStepChannel");
DROP TYPE "SequenceStepChannel_old";

-- Tasks (drop default before enum swap)
UPDATE "tasks" SET "type" = 'custom' WHERE "type"::text = 'linkedin';
ALTER TABLE "tasks" ALTER COLUMN "type" DROP DEFAULT;

ALTER TYPE "TaskType" RENAME TO "TaskType_old";
CREATE TYPE "TaskType" AS ENUM ('call', 'email', 'whatsapp', 'meeting', 'follow_up', 'custom');
ALTER TABLE "tasks"
  ALTER COLUMN "type" TYPE "TaskType"
  USING ("type"::text::"TaskType");
ALTER TABLE "tasks" ALTER COLUMN "type" SET DEFAULT 'follow_up'::"TaskType";
DROP TYPE "TaskType_old";

-- Activities
UPDATE "activities" SET "type" = 'task_created' WHERE "type"::text = 'linkedin_task';

ALTER TYPE "ActivityType" RENAME TO "ActivityType_old";
CREATE TYPE "ActivityType" AS ENUM (
  'lead_created',
  'email_sent',
  'email_received',
  'email_opened',
  'email_clicked',
  'whatsapp_sent',
  'whatsapp_received',
  'sms_sent',
  'call_started',
  'call_completed',
  'call_failed',
  'meeting_scheduled',
  'meeting_completed',
  'note_added',
  'task_created',
  'stage_changed',
  'owner_changed'
);
ALTER TABLE "activities"
  ALTER COLUMN "type" TYPE "ActivityType"
  USING ("type"::text::"ActivityType");
DROP TYPE "ActivityType_old";
