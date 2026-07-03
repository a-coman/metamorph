UPDATE "mr_definitions"
SET "transform_family" = 'subset'
WHERE "transform_family" = 'inclusion';

UPDATE "mr_definitions"
SET "definition" = replace("definition"::text, '"transform_family": "inclusion"', '"transform_family": "subset"')::jsonb
WHERE "definition"::text LIKE '%"transform_family": "inclusion"%';

UPDATE "sessions"
SET "transform_families" = array_replace("transform_families", 'inclusion', 'subset')
WHERE 'inclusion' = ANY("transform_families");

ALTER TABLE "sessions"
ALTER COLUMN "transform_families"
SET DEFAULT ARRAY['idempotence', 'subset', 'permutation', 'inverse']::TEXT[];
