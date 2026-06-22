export type PlanExploreFailureType =
  | 'validation_error'
  | 'empty_steps'
  | 'invalid_element_ids'
  | 'invalid_fill_target'
  | 'plan_error';

export function derivePlanFailureType(error: string): PlanExploreFailureType {
  if (/failed validation|invalid_type|invalid_value|required/i.test(error)) {
    return 'validation_error';
  }
  if (/no executable steps|steps=\(empty\)|append_steps with no/i.test(error)) {
    return 'empty_steps';
  }
  if (/Unknown element_ids/i.test(error)) {
    return 'invalid_element_ids';
  }
  if (/fill not allowed/i.test(error)) {
    return 'invalid_fill_target';
  }
  return 'plan_error';
}

export function readPlanExploreError(response: Record<string, unknown>): string | null {
  const error = response.error;
  return typeof error === 'string' && error.length > 0 ? error : null;
}
