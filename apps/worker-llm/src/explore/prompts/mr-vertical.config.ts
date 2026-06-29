import {
  OBSERVATION_CATALOG_FIELDS,
  TRANSFORM_FAMILIES,
  getFamilyProfile,
  type TransformFamily,
} from '@metamorph/core';

export const MR_PLAN_OPTIONS = {
  transformFamilies: TRANSFORM_FAMILIES,
  relationTypes: ['equal', 'cardinality_lte'] as const,
  observationFields: OBSERVATION_CATALOG_FIELDS,
} as const;

/** What each transform_family means for MR design and phase goals. */
export const TRANSFORM_FAMILY_SEMANTICS: Record<TransformFamily, string> = {
  idempotence:
    'Apply an action once to reach an intermediate state P (source). Apply the same action again on P (the transformation). ' +
    'The observable outcome should not change. ' +
    'source_phase_goal: from a fresh context, reach P. ' +
    'follow_up_phase_goal: from another fresh context, rebuild the path to P, then apply the transformation once more. ' +
    'follow_up is NOT merely re-running the same scenario as source — it must include the extra transformation step after reaching P.',
  inclusion:
    'From a base results state P (source), apply an additional filter or restriction in follow_up. ' +
    'The total result count reported by the site (result info label) should not increase. ' +
    'source_phase_goal: from a fresh context, reach unfiltered search results P with a visible results summary label. ' +
    'follow_up_phase_goal: from another fresh context, rebuild the path to P, then apply one additional filter.',
  permutation:
    'Apply two independent actions (e.g. filters) in different orders. The final observable state should be the same. ' +
    'source_phase_goal: from a fresh context, apply action A then action B to reach state P. ' +
    'follow_up_phase_goal: from another fresh context, apply action B then action A.',
  inverse:
    'Apply a transformation T to reach state P (source). In follow_up, reach P and apply the inverse T⁻¹ (undo, clear filter, back). ' +
    'The final state should match source. ' +
    'source_phase_goal: from a fresh context, apply T to reach P. ' +
    'follow_up_phase_goal: from another fresh context, rebuild the path to P, then apply T⁻¹.',
};

/** What each relation.type means when comparing source vs follow_up observations. */
export const RELATION_TYPE_SEMANTICS: Record<
  (typeof MR_PLAN_OPTIONS.relationTypes)[number],
  string
> = {
  equal:
    'Each field in relation.on must have the same value in the source observation and the follow_up observation.',
  cardinality_lte:
    'For numeric fields in relation.on, the follow_up value must be less than or equal to the source value.',
};

/** What each observation catalog field measures at the end of a scenario. */
export const OBSERVATION_FIELD_SEMANTICS: Record<
  (typeof MR_PLAN_OPTIONS.observationFields)[number],
  string
> = {
  applied_query:
    'The search query string reflected in the page input or URL when the scenario ends.',
  results_url:
    'Normalized results page URL (pathname plus stable query params such as k or q, sorted alphabetically).',
  reported_total_results:
    'Total number of matching results as reported by the site in a result summary label (e.g. "1-48 of over 30,000 results").',
};

export function getFamilyPlanProfile(family: TransformFamily) {
  return getFamilyProfile(family);
}
