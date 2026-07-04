import {
  TRANSFORM_FAMILIES,
  getFamilyProfile,
  type TransformFamily,
} from '@metamorph/core';

export const MR_PLAN_OPTIONS = {
  transformFamilies: TRANSFORM_FAMILIES,
  compareOperators: ['equal', 'set_equal', 'cardinality_lte'] as const,
} as const;

export const TRANSFORM_FAMILY_SEMANTICS: Record<TransformFamily, string> = {
  idempotence:
    'Apply an action once to reach an intermediate state P (source). Apply the same action again on P (the transformation). ' +
    'The observable outcome should not change. ' +
    'source_phase_goal: from a fresh context, reach P. ' +
    'follow_up_phase_goal: from another fresh context, rebuild the path to P, then apply the transformation once more. ' +
    'follow_up is NOT merely re-running the same scenario as source — it must include the extra transformation step after reaching P.',
  subset:
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

export const COMPARE_OPERATOR_SEMANTICS: Record<
  (typeof MR_PLAN_OPTIONS.compareOperators)[number],
  string
> = {
  equal:
    'The follow_up value must equal the source value.',
  set_equal:
    'The follow_up set must equal the source set (order ignored).',
  cardinality_lte:
    'For numeric observables, follow_up must be less than or equal to source.',
};

export function getFamilyPlanProfile(family: TransformFamily) {
  return getFamilyProfile(family);
}
