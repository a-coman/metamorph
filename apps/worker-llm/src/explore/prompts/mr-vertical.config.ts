import { OBSERVATION_CATALOG_FIELDS } from '@metamorph/core';

export const MR_PLAN_OPTIONS = {
  transformFamilies: ['idempotence'] as const,
  relationTypes: ['equal'] as const,
  observationFields: OBSERVATION_CATALOG_FIELDS,
} as const;
