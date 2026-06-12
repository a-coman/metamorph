import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { computeFailedBatchIndex } from './compute-failed-batch-index.js';

describe('computeFailedBatchIndex', () => {
  const rawSteps = [
    { id: 1, action: 'click' as const, element_id: 'E21' },
    { id: 2, action: 'click' as const, element_id: 'E61' },
    { id: 3, action: 'click' as const, element_id: 'E01' },
  ];

  const allSteps = [
    { id: 1, action: 'goto' as const, url: 'https://www.example.com/' },
    ...rawSteps.map((step, index) => ({ ...step, id: index + 2 })),
  ];

  it('maps full probe index to batch index after goto prefix and validated prefix', () => {
    const batchIndex = computeFailedBatchIndex({
      allSteps,
      rawSteps,
      validatedPrefixLength: 1,
      probeStepsLength: 2,
      failedStepIndex: 3,
    });

    assert.equal(batchIndex, 1);
  });

  it('returns undefined when failure is outside the batch', () => {
    const batchIndex = computeFailedBatchIndex({
      allSteps,
      rawSteps,
      validatedPrefixLength: 1,
      probeStepsLength: 2,
      failedStepIndex: 1,
    });

    assert.equal(batchIndex, undefined);
  });
});
