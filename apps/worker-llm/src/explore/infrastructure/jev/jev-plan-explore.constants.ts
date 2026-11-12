export const PLAN_EXPLORE_JEV_PROMPT_VERSION = 'plan-explore-jev-v2';
export const PLAN_EXPLORE_FILL_PROMPT_VERSION = 'plan-explore-fill-v2';

export const JEV_CHOICE_MAX = 255;
export const JEV_ACTION_CANDIDATE_MAX = 40;
export const JEV_OVERLAY_CANDIDATE_MAX = 12;
export const NONE_CHOICE = 'none';
export const JEV_MIN_CONFIDENCE = 0.4;
export const JEV_NOUL_OVERLAY = 0.55;
export const JEV_NOUL_GOAL_MET = 0.8;
export const JEV_NOUL_BLOCKED = 0.75;
export const JEV_NOUL_SCROLL = 0.55;
export const JEV_WAIT_FIRST_THRESHOLD = 0.5;
export const JEV_WAIT_PREFIX_MS = 400;
export const JEV_SCROLL_DOWN_PX = 800;
export const JEV_SCROLL_UP_PX = -600;

export const DEFAULT_JEV_MODEL = 'typesafe/jev-1.13';
export const DEFAULT_DECISIONS_URL = 'https://openrouter.ai/api/alpha/decisions';

export const PLAN_ACTIONS = ['append_steps', 'scenario_complete', 'abort'] as const;
export const PLAN_OPERATIONS = [
  'click',
  'fill',
  'selectOption',
  'press',
  'scroll',
  'waitFor',
] as const;
export const ABORT_REASONS = ['auth_wall', 'captcha', 'impossible_mr', 'other'] as const;
export const PRESS_KEYS = ['Enter', 'Tab', 'Escape'] as const;
export const SCROLL_DIRS = ['down', 'up'] as const;

export const ABORT_RATIONALE: Record<(typeof ABORT_REASONS)[number], string> = {
  auth_wall: 'Aborted: login or account wall blocks the phase goal.',
  captcha: 'Aborted: captcha blocks the phase goal.',
  impossible_mr: 'Aborted: the metamorphic relation is not achievable on this page.',
  other: 'Aborted: the phase goal is permanently unachievable.',
};
