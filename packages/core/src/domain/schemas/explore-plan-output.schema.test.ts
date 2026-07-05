import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  ExplorePlanOutputSchema,
  PLAN_EXPLORE_MAX_STEPS_PER_BATCH,
} from './explore-plan-output.schema.js';

describe('ExplorePlanOutputSchema', () => {
  it('requires steps when action is append_steps', () => {
    const missingSteps = ExplorePlanOutputSchema.safeParse({
      action: 'append_steps',
      rationale: 'Dismiss cookie banner',
    });
    assert.equal(missingSteps.success, false);

    const emptySteps = ExplorePlanOutputSchema.safeParse({
      action: 'append_steps',
      rationale: 'Dismiss cookie banner',
      steps: [],
    });
    assert.equal(emptySteps.success, false);

    const valid = ExplorePlanOutputSchema.safeParse({
      action: 'append_steps',
      rationale: 'Dismiss cookie banner',
      steps: [{ id: 1, action: 'click', element_id: 'E1' }],
    });
    assert.equal(valid.success, true);

    const scroll = ExplorePlanOutputSchema.safeParse({
      action: 'append_steps',
      rationale: 'Reveal filters below the fold',
      steps: [{ id: 1, action: 'scroll', scroll_y: 800 }],
    });
    assert.equal(scroll.success, true);
  });

  it('rejects append_steps with more than PLAN_EXPLORE_MAX_STEPS_PER_BATCH steps', () => {
    const steps = Array.from({ length: PLAN_EXPLORE_MAX_STEPS_PER_BATCH + 1 }, (_, index) => ({
      id: index + 1,
      action: 'click' as const,
      element_id: 'E1',
    }));

    const result = ExplorePlanOutputSchema.safeParse({
      action: 'append_steps',
      rationale: 'Too many steps',
      steps,
    });
    assert.equal(result.success, false);
  });

  it('allows scenario_complete and abort without steps', () => {
    const scenarioComplete = ExplorePlanOutputSchema.safeParse({
      action: 'scenario_complete',
      rationale: 'Search results already visible',
    });
    assert.equal(scenarioComplete.success, true);

    const abort = ExplorePlanOutputSchema.safeParse({
      action: 'abort',
      rationale: 'Captcha blocks progress',
    });
    assert.equal(abort.success, true);
  });
});
