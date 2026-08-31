-- Remove sequence automation feature completely.

-- Drop dependent FKs / tables first
ALTER TABLE "campaigns" DROP CONSTRAINT IF EXISTS "campaigns_sequence_id_fkey";

DROP TABLE IF EXISTS "sequence_enrollments";
DROP TABLE IF EXISTS "sequence_steps";
DROP TABLE IF EXISTS "sequences";

ALTER TABLE "campaigns" DROP COLUMN IF EXISTS "sequence_id";
ALTER TABLE "referral_links" DROP COLUMN IF EXISTS "sequence_id";
ALTER TABLE "plans" DROP COLUMN IF EXISTS "max_sequences";

DROP TYPE IF EXISTS "EnrollmentStatus";
DROP TYPE IF EXISTS "SequenceCondition";
DROP TYPE IF EXISTS "SequenceStepChannel";
DROP TYPE IF EXISTS "SequenceStatus";

DELETE FROM "feature_flag_overrides"
WHERE "feature_flag_id" IN (
  SELECT "id" FROM "feature_flags" WHERE "key" = 'sequences' OR "id" = 'ff_sequences'
);

DELETE FROM "feature_flags"
WHERE "key" = 'sequences' OR "id" = 'ff_sequences';
