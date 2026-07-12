-- Observation payload validation is derived from the persisted ObservationSpec
-- with Zod. The JSON Schema blob was redundant and was never consumed at runtime.
BEGIN;

ALTER TABLE "mr_versions"
  DROP CONSTRAINT IF EXISTS "mr_versions_schema_blob_id_fkey";

ALTER TABLE "mr_versions"
  DROP COLUMN IF EXISTS "schema_blob_id",
  ADD COLUMN "replay_bundle_hash" TEXT;

ALTER TABLE "runs"
  ADD COLUMN "replay_bundle_hash" TEXT;

DROP TABLE IF EXISTS "schema_blobs";

COMMIT;
