import { OBSERVATION_CATALOG_FIELDS } from '@metamorph/core';

export const MR_PLAN_OPTIONS = {
  transformFamilies: ['idempotence'] as const,
  relationTypes: ['equal'] as const,
  observationFields: OBSERVATION_CATALOG_FIELDS,
} as const;

/** What each transform_family means for MR design and phase goals. */
export const TRANSFORM_FAMILY_SEMANTICS: Record<
  (typeof MR_PLAN_OPTIONS.transformFamilies)[number],
  string
> = {
  idempotence:
    'Apply an action once to reach an intermediate state P (source). Apply the same action again on P (the transformation). ' +
    'The observable outcome should not change. ' +
    'source_phase_goal: from a fresh context, reach P. ' +
    'follow_up_phase_goal: from another fresh context, rebuild the path to P, then apply the transformation once more. ' +
    'follow_up is NOT merely re-running the same scenario as source — it must include the extra transformation step after reaching P.',
};

/** What each relation.type means when comparing source vs follow_up observations. */
export const RELATION_TYPE_SEMANTICS: Record<
  (typeof MR_PLAN_OPTIONS.relationTypes)[number],
  string
> = {
  equal:
    'Each field in relation.on must have the same value in the source observation and the follow_up observation.',
};

/** What each observation catalog field measures at the end of a scenario. */
export const OBSERVATION_FIELD_SEMANTICS: Record<
  (typeof MR_PLAN_OPTIONS.observationFields)[number],
  string
> = {
  applied_query:
    'The search query string reflected in the page input or URL when the scenario ends.',
  results_url:
    'Normalized results page URL (pathname plus stable query params such as k or q).',
};
