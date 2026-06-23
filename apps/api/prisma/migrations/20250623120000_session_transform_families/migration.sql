-- AlterTable
ALTER TABLE "sessions" ADD COLUMN "transform_families" TEXT[] NOT NULL DEFAULT ARRAY['idempotence', 'inclusion', 'permutation', 'inverse']::TEXT[];
