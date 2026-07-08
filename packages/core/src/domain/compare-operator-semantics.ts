import type { ObservableCompare } from './schemas/observable.schema.js';

export const COMPARE_OPERATOR_SEMANTICS = {
  equal: 'The follow_up value must equal the source value.',
  not_equal: 'The follow_up value must not equal the source value.',
  set_equal: 'The follow_up set must equal the source set (order ignored).',
  cardinality_lte:
    'For numeric observables, follow_up must be less than or equal to source.',
} satisfies Record<ObservableCompare, string>;
