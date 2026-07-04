import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { MrIntent } from '@metamorph/core';
import { buildExploreVerifyUserText } from './explore-verify.prompt.js';

const mrIntent: MrIntent = {
  mr_definition: {
    precondition: { description: 'Page loads' },
    transformation: {
      transform_family: 'idempotence',
      description: 'Repeat search',
    },
    relation: {
      on: ['applied_query'],
      description: 'Queries match',
    },
  },
  exploration: {
    source_phase_goal: 'Search for laptops',
    follow_up_phase_goal: 'Repeat search with filter',
  },
};

describe('buildExploreVerifyUserText', () => {
  it('includes planner rationale before executed steps when provided', () => {
    const text = buildExploreVerifyUserText({
      url: 'https://www.example.com/',
      urlAfter: 'https://www.example.com/s?k=auriculares',
      phase: 'source',
      mrIntent,
      validatedSteps: { source: [], follow_up: [] },
      executedSteps: [
        { id: 1, action: 'click', element_id: 'E35' },
        { id: 2, action: 'fill', element_id: 'E1', value: 'auriculares' },
      ],
      batchRationale:
        'Dismiss cookie banner, then search for auriculares and press Enter.',
    });

    const rationaleIndex = text.indexOf('Planner rationale (intended sub-goal for this batch):');
    const executedIndex = text.indexOf('Executed steps (this batch only):');

    assert.ok(rationaleIndex >= 0);
    assert.ok(executedIndex > rationaleIndex);
    assert.match(text, /Dismiss cookie banner, then search for auriculares/);
  });

  it('omits planner rationale section when not provided', () => {
    const text = buildExploreVerifyUserText({
      url: 'https://www.example.com/',
      urlAfter: 'https://www.example.com/',
      phase: 'source',
      mrIntent,
      validatedSteps: { source: [], follow_up: [] },
      executedSteps: [{ id: 1, action: 'click', element_id: 'E35' }],
    });

    assert.doesNotMatch(text, /Planner rationale/);
    assert.match(text, /Executed steps \(this batch only\):/);
  });
});
