-- AlterTable
ALTER TABLE "mr_versions" ADD COLUMN "exploration_failure_reason" TEXT;
ALTER TABLE "mr_versions" ADD COLUMN "exploration_goals" JSONB;
