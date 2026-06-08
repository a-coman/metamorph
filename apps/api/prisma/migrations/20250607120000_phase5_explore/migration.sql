-- Phase 5: incremental exploration with LangGraph
ALTER TYPE "MrVersionStatus" ADD VALUE IF NOT EXISTS 'exploring';

ALTER TYPE "MrVersionStatus" ADD VALUE IF NOT EXISTS 'exploration_failed';

ALTER TYPE "JobType" ADD VALUE IF NOT EXISTS 'explore';

ALTER TYPE "JobType" ADD VALUE IF NOT EXISTS 'probe';

CREATE TABLE "exploration_checkpoints" (
    "id" UUID NOT NULL,
    "mr_version_id" UUID NOT NULL,
    "phase" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL,
    "snapshot_id" UUID NOT NULL,
    "steps_json" JSONB NOT NULL,
    "verdict" TEXT NOT NULL,
    "rationale" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "exploration_checkpoints_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "exploration_checkpoints_mr_version_id_idx" ON "exploration_checkpoints" ("mr_version_id");

ALTER TABLE "exploration_checkpoints" ADD CONSTRAINT "exploration_checkpoints_mr_version_id_fkey" FOREIGN KEY ("mr_version_id") REFERENCES "mr_versions" ("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "exploration_checkpoints" ADD CONSTRAINT "exploration_checkpoints_snapshot_id_fkey" FOREIGN KEY ("snapshot_id") REFERENCES "page_snapshots" ("id") ON DELETE RESTRICT ON UPDATE CASCADE;