-- CreateEnum
CREATE TYPE "SessionControlStatus" AS ENUM ('active', 'pausing', 'paused');

-- AlterEnum
ALTER TYPE "JobStatus" ADD VALUE 'paused';

ALTER TYPE "RunStatus" ADD VALUE 'paused';

-- AlterTable
ALTER TABLE "sessions"
ADD COLUMN "control_status" "SessionControlStatus" NOT NULL DEFAULT 'active';

ALTER TABLE "sessions"
ADD COLUMN "control_status_changed_at" TIMESTAMP(3);