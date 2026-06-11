export const PLAN_EXPLORE_OPTIONS = {
  topLevelActions: ['append_steps', 'scenario_complete', 'abort'] as const,
  stepActions: [
    'goto',
    'click',
    'fill',
    'selectOption',
    'press',
    'scroll',
    'waitFor',
  ] as const,
  maxStepsPerBatch: 3,
} as const;
