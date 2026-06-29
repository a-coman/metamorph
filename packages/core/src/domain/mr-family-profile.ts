import type { MrDefinition, RelationType } from './schemas/mr-definition.schema.js';
import type { ObservationCatalogField } from './schemas/observation-catalog.schema.js';

export const TRANSFORM_FAMILIES = [
  'idempotence',
  'inclusion',
  'permutation',
  'inverse',
] as const;

export type TransformFamily = (typeof TRANSFORM_FAMILIES)[number];

export const TransformFamilySchema = {
  options: TRANSFORM_FAMILIES,
} as const;

export type FamilyProfile = {
  transformFamily: TransformFamily;
  relationType: RelationType;
  observationFields: readonly ObservationCatalogField[];
};

const FAMILY_PROFILES: Record<TransformFamily, FamilyProfile> = {
  idempotence: {
    transformFamily: 'idempotence',
    relationType: 'equal',
    observationFields: ['applied_query', 'results_url'],
  },
  inclusion: {
    transformFamily: 'inclusion',
    relationType: 'cardinality_lte',
    observationFields: ['applied_query', 'reported_total_results'],
  },
  permutation: {
    transformFamily: 'permutation',
    relationType: 'equal',
    observationFields: ['applied_query', 'results_url'],
  },
  inverse: {
    transformFamily: 'inverse',
    relationType: 'equal',
    observationFields: ['applied_query', 'results_url'],
  },
};

export function isTransformFamily(value: string): value is TransformFamily {
  return (TRANSFORM_FAMILIES as readonly string[]).includes(value);
}

export function getFamilyProfile(family: TransformFamily): FamilyProfile {
  return FAMILY_PROFILES[family];
}

export function applyFamilyProfile(
  mrDefinition: MrDefinition,
  family: TransformFamily,
): MrDefinition {
  const profile = getFamilyProfile(family);

  return {
    ...mrDefinition,
    transformation: {
      ...mrDefinition.transformation,
      transform_family: profile.transformFamily,
    },
    relation: {
      ...mrDefinition.relation,
      type: profile.relationType,
      on: [...profile.observationFields],
    },
  };
}
