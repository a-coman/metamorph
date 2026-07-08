import type { MrDefinition, RelationType } from './schemas/mr-definition.schema.js';
import type { ObservableCompare } from './schemas/observable.schema.js';

export const TRANSFORM_FAMILIES = [
  'idempotence',
  'subset',
  'permutation',
  'inverse',
] as const;

export type TransformFamily = (typeof TRANSFORM_FAMILIES)[number];

export const TransformFamilySchema = {
  options: TRANSFORM_FAMILIES,
} as const;

export type FamilyProfile = {
  transformFamily: TransformFamily;
  allowedCompares: readonly ObservableCompare[];
  observationIntentHints: readonly string[];
};

const FAMILY_PROFILES: Record<TransformFamily, FamilyProfile> = {
  idempotence: {
    transformFamily: 'idempotence',
    allowedCompares: ['equal'],
    observationIntentHints: [
      'search terms or form inputs unchanged',
      'stable URL or pathname',
      'active filters unchanged',
      'result count unchanged',
      'listing content fingerprint',
    ],
  },
  subset: {
    transformFamily: 'subset',
    allowedCompares: ['equal', 'cardinality_lte'],
    observationIntentHints: [
      'base query or search inputs stable',
      'reported or visible result count does not increase',
    ],
  },
  permutation: {
    transformFamily: 'permutation',
    allowedCompares: ['equal', 'set_equal'],
    observationIntentHints: [
      'filter or sort selections order-independent',
      'final URL or results stable',
    ],
  },
  inverse: {
    transformFamily: 'inverse',
    allowedCompares: ['equal', 'not_equal'],
    observationIntentHints: [
      'header chrome unchanged after undo (equal)',
      'transformation-specific fields differ from source after undo (not_equal)',
      'search input or pathname encodes T vs T⁻¹ state',
    ],
  },
};

export function isTransformFamily(value: string): value is TransformFamily {
  return (TRANSFORM_FAMILIES as readonly string[]).includes(value);
}

export function getFamilyProfile(family: TransformFamily): FamilyProfile {
  return FAMILY_PROFILES[family];
}

export function isCompareAllowedForFamily(
  family: TransformFamily,
  compare: ObservableCompare,
): boolean {
  return getFamilyProfile(family).allowedCompares.includes(compare);
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
      on: mrDefinition.relation.on ?? [],
    },
  };
}

/** @deprecated Use ObservableCompare from observable.schema */
export type { RelationType };
