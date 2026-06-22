import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { ExplorePlanOutputSchema } from './explore-plan-output.schema.js';

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
