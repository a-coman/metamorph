-- CreateEnum
CREATE TYPE "SessionMode" AS ENUM ('hitl', 'auto');

CREATE TYPE "JobStatus" AS ENUM (
    'pending_enqueue',
    'queued',
    'running',
    'done',
    'failed',
    'enqueue_failed'
);

CREATE TYPE "JobType" AS ENUM (
    'discover',
    'execute_pair',
    'replay',
    'regenerate_step',
    'llm_oracle'
);

CREATE TYPE "MrVersionStatus" AS ENUM (
    'draft_pending_hitl',
    'approved',
    'replayable',
    'stale',
    'violation_pending_triage'
);

CREATE TYPE "Verdict" AS ENUM ('pass', 'fail');

CREATE TYPE "VerdictEffective" AS ENUM ('pass', 'fail', 'fail_weak_disagreement');

CREATE TYPE "ViolationTriage" AS ENUM ('false_positive', 'bug', 'flaky', 'bad_mr');

CREATE TYPE "ObservationRole" AS ENUM ('source', 'follow_up');

CREATE TYPE "ArtifactKind" AS ENUM (
    'screenshot',
    'annotated_screenshot',
    'trace',
    'video'
);

CREATE TYPE "RunStatus" AS ENUM ('pending', 'running', 'completed', 'failed');

-- Tables (FKs deferred to end)
CREATE TABLE "sessions" (
    "id" UUID NOT NULL,
    "url" TEXT NOT NULL,
    "mode" "SessionMode" NOT NULL DEFAULT 'hitl',
    "generate_count" INTEGER NOT NULL DEFAULT 1,
    "weak_oracle" BOOLEAN NOT NULL DEFAULT false,
    "user_mr_json" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "playbook_blobs" (
    "id" UUID NOT NULL,
    "content" TEXT NOT NULL,
    "content_hash" TEXT NOT NULL,
    "template_version" TEXT NOT NULL DEFAULT 'playbook-template@1',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "playbook_blobs_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "schema_blobs" (
    "id" UUID NOT NULL,
    "content" TEXT NOT NULL,
    "content_hash" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "schema_blobs_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "mr_definitions" (
    "id" UUID NOT NULL,
    "host" TEXT NOT NULL,
    "transform_family" TEXT NOT NULL,
    "definition" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "mr_definitions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "jobs" (
    "id" UUID NOT NULL,
    "session_id" UUID NOT NULL,
    "mr_version_id" UUID,
    "type" "JobType" NOT NULL,
    "status" "JobStatus" NOT NULL DEFAULT 'pending_enqueue',
    "payload" JSONB NOT NULL DEFAULT '{}',
    "attempt" INTEGER NOT NULL DEFAULT 1,
    "max_attempts" INTEGER NOT NULL DEFAULT 3,
    "error_message" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "started_at" TIMESTAMP(3),
    "finished_at" TIMESTAMP(3),
    CONSTRAINT "jobs_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "artifacts" (
    "id" UUID NOT NULL,
    "session_id" UUID,
    "run_id" UUID,
    "page_snapshot_id" UUID,
    "kind" "ArtifactKind" NOT NULL,
    "path" TEXT NOT NULL,
    "mime_type" TEXT,
    "size_bytes" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "artifacts_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "page_snapshots" (
    "id" UUID NOT NULL,
    "session_id" UUID NOT NULL,
    "job_id" UUID,
    "url" TEXT NOT NULL,
    "inventory" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "annotated_screenshot_artifact_id" UUID,
    "raw_screenshot_artifact_id" UUID,
    CONSTRAINT "page_snapshots_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "mr_versions" (
    "id" UUID NOT NULL,
    "session_id" UUID NOT NULL,
    "mr_definition_id" UUID NOT NULL,
    "page_snapshot_id" UUID,
    "status" "MrVersionStatus" NOT NULL DEFAULT 'draft_pending_hitl',
    "generation_slots" JSONB NOT NULL DEFAULT '{}',
    "playbook_blob_id" UUID,
    "schema_blob_id" UUID,
    "locator_validation_score" DOUBLE PRECISION,
    "approved_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "mr_versions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "runs" (
    "id" UUID NOT NULL,
    "mr_version_id" UUID NOT NULL,
    "job_id" UUID NOT NULL,
    "status" "RunStatus" NOT NULL DEFAULT 'pending',
    "input_bundle" JSONB NOT NULL DEFAULT '{}',
    "attempt" INTEGER NOT NULL DEFAULT 1,
    "verdict_strict" "Verdict",
    "verdict_weak" "Verdict",
    "verdict_effective" "VerdictEffective",
    "playbook_content_hash" TEXT,
    "openrouter_model" TEXT,
    "prompt_version" TEXT,
    "source_final_url" TEXT,
    "follow_up_final_url" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finished_at" TIMESTAMP(3),
    CONSTRAINT "runs_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "observations" (
    "id" UUID NOT NULL,
    "run_id" UUID NOT NULL,
    "role" "ObservationRole" NOT NULL,
    "payload" JSONB NOT NULL,
    "payload_hash" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "observations_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "violations" (
    "id" UUID NOT NULL,
    "run_id" UUID NOT NULL,
    "mr_version_id" UUID NOT NULL,
    "verdict_strict" "Verdict" NOT NULL DEFAULT 'fail',
    "triage" "ViolationTriage",
    "triage_note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "triaged_at" TIMESTAMP(3),
    CONSTRAINT "violations_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "llm_calls" (
    "id" UUID NOT NULL,
    "job_id" UUID,
    "run_id" UUID,
    "mr_version_id" UUID,
    "purpose" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "prompt_version" TEXT NOT NULL,
    "tokens_in" INTEGER,
    "tokens_out" INTEGER,
    "latency_ms" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "llm_calls_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "worker_config" (
    "id" VARCHAR(32) NOT NULL,
    "max_concurrent_browsers" INTEGER NOT NULL DEFAULT 2,
    "playwright_headless" BOOLEAN NOT NULL DEFAULT true,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "worker_config_pkey" PRIMARY KEY ("id")
);

-- Indexes
CREATE INDEX "playbook_blobs_content_hash_idx" ON "playbook_blobs" ("content_hash");

CREATE INDEX "schema_blobs_content_hash_idx" ON "schema_blobs" ("content_hash");

CREATE INDEX "mr_definitions_host_transform_family_idx" ON "mr_definitions" ("host", "transform_family");

CREATE INDEX "jobs_session_id_idx" ON "jobs" ("session_id");

CREATE INDEX "jobs_status_idx" ON "jobs" ("status");

CREATE INDEX "jobs_type_status_idx" ON "jobs" ("type", "status");

CREATE INDEX "artifacts_run_id_idx" ON "artifacts" ("run_id");

CREATE INDEX "artifacts_session_id_idx" ON "artifacts" ("session_id");

CREATE UNIQUE INDEX "page_snapshots_annotated_screenshot_artifact_id_key" ON "page_snapshots" ("annotated_screenshot_artifact_id");

CREATE UNIQUE INDEX "page_snapshots_raw_screenshot_artifact_id_key" ON "page_snapshots" ("raw_screenshot_artifact_id");

CREATE INDEX "page_snapshots_session_id_idx" ON "page_snapshots" ("session_id");

CREATE INDEX "mr_versions_session_id_idx" ON "mr_versions" ("session_id");

CREATE INDEX "mr_versions_status_idx" ON "mr_versions" ("status");

CREATE INDEX "mr_versions_mr_definition_id_idx" ON "mr_versions" ("mr_definition_id");

CREATE INDEX "runs_mr_version_id_idx" ON "runs" ("mr_version_id");

CREATE INDEX "runs_job_id_idx" ON "runs" ("job_id");

CREATE UNIQUE INDEX "observations_run_id_role_key" ON "observations" ("run_id", "role");

CREATE INDEX "violations_mr_version_id_idx" ON "violations" ("mr_version_id");

CREATE INDEX "llm_calls_job_id_idx" ON "llm_calls" ("job_id");

-- Foreign keys
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "sessions" ("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "jobs" ADD CONSTRAINT "jobs_mr_version_id_fkey" FOREIGN KEY ("mr_version_id") REFERENCES "mr_versions" ("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "artifacts" ADD CONSTRAINT "artifacts_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "sessions" ("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "artifacts" ADD CONSTRAINT "artifacts_run_id_fkey" FOREIGN KEY ("run_id") REFERENCES "runs" ("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "artifacts" ADD CONSTRAINT "artifacts_page_snapshot_id_fkey" FOREIGN KEY ("page_snapshot_id") REFERENCES "page_snapshots" ("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "page_snapshots" ADD CONSTRAINT "page_snapshots_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "sessions" ("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "page_snapshots" ADD CONSTRAINT "page_snapshots_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "jobs" ("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "page_snapshots" ADD CONSTRAINT "page_snapshots_annotated_screenshot_artifact_id_fkey" FOREIGN KEY ("annotated_screenshot_artifact_id") REFERENCES "artifacts" ("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "page_snapshots" ADD CONSTRAINT "page_snapshots_raw_screenshot_artifact_id_fkey" FOREIGN KEY ("raw_screenshot_artifact_id") REFERENCES "artifacts" ("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "mr_versions" ADD CONSTRAINT "mr_versions_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "sessions" ("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "mr_versions" ADD CONSTRAINT "mr_versions_mr_definition_id_fkey" FOREIGN KEY ("mr_definition_id") REFERENCES "mr_definitions" ("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "mr_versions" ADD CONSTRAINT "mr_versions_page_snapshot_id_fkey" FOREIGN KEY ("page_snapshot_id") REFERENCES "page_snapshots" ("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "mr_versions" ADD CONSTRAINT "mr_versions_playbook_blob_id_fkey" FOREIGN KEY ("playbook_blob_id") REFERENCES "playbook_blobs" ("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "mr_versions" ADD CONSTRAINT "mr_versions_schema_blob_id_fkey" FOREIGN KEY ("schema_blob_id") REFERENCES "schema_blobs" ("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "runs" ADD CONSTRAINT "runs_mr_version_id_fkey" FOREIGN KEY ("mr_version_id") REFERENCES "mr_versions" ("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "runs" ADD CONSTRAINT "runs_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "jobs" ("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "observations" ADD CONSTRAINT "observations_run_id_fkey" FOREIGN KEY ("run_id") REFERENCES "runs" ("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "violations" ADD CONSTRAINT "violations_run_id_fkey" FOREIGN KEY ("run_id") REFERENCES "runs" ("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "violations" ADD CONSTRAINT "violations_mr_version_id_fkey" FOREIGN KEY ("mr_version_id") REFERENCES "mr_versions" ("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "llm_calls" ADD CONSTRAINT "llm_calls_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "jobs" ("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "llm_calls" ADD CONSTRAINT "llm_calls_run_id_fkey" FOREIGN KEY ("run_id") REFERENCES "runs" ("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "llm_calls" ADD CONSTRAINT "llm_calls_mr_version_id_fkey" FOREIGN KEY ("mr_version_id") REFERENCES "mr_versions" ("id") ON DELETE SET NULL ON UPDATE CASCADE;

INSERT INTO
    "worker_config" (
        "id",
        "max_concurrent_browsers",
        "playwright_headless",
        "updated_at"
    )
VALUES
    ('default', 2, true, CURRENT_TIMESTAMP);