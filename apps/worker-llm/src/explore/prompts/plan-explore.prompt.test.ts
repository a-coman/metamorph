import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { buildPlanExploreUserText } from './plan-explore.prompt.js';
import type { MrIntent } from '@metamorph/core';

const mrIntent: MrIntent = {
  mr_definition: {
    precondition: { description: 'Page loads' },
    transformation: {
      transform_family: 'idempotence',
      description: 'Repeat search',
    },
    relation: {
      type: 'equal',
      on: ['applied_query'],
      description: 'Queries match',
    },
  },
  exploration: {
    source_phase_goal: 'Search for laptops',
    follow_up_phase_goal: 'Repeat search with filter',
  },
};

const inventory = {
  url: 'https://www.example.com/',
  capturedAt: '2026-01-01T00:00:00.000Z',
  pageMetrics: { width: 1920, height: 1080 },
  viewport: { width: 1920, height: 1080 },
  items: [],
  labeledCount: 0,
};

describe('buildPlanExploreUserText probe failure context', () => {
  it('includes failure section and dual attachment labels when context is present', () => {
    const text = buildPlanExploreUserText({
      url: 'https://www.example.com/',
      phase: 'source',
      mrIntent,
      inventory,
      validatedSteps: { source: [], follow_up: [] },
      probeError: 'Timeout waiting for locator',
      batchSize: 2,
      probeFailureContext: {
        failedStep: {
          id: 2,
          action: 'click',
          element_id: 'E01',
          resolved_locator: "getByTestId('search-button')",
        },
        failedStepIndex: 3,
        failedBatchIndex: 1,
        failedBatchSize: 2,
        urlBeforeFailure: 'https://www.example.com/listings',
        screenshotBeforeSnapshotId: '00000000-0000-4000-8000-000000000001',
      },
    });

    assert.match(text, /Last probe failure:/);
    assert.match(text, /error: Timeout waiting for locator/);
    assert.match(text, /url before failure: https:\/\/www\.example\.com\/listings/);
    assert.match(text, /batch index 2 of 2/);
    assert.match(text, /getByTestId\('search-button'\)/);
    assert.match(text, /1\. Current inventory screenshot/);
    assert.match(text, /2\. Probe failure context/);
  });

  it('keeps legacy probe error line when no failure context', () => {
    const text = buildPlanExploreUserText({
      url: 'https://www.example.com/',
      phase: 'source',
      mrIntent,
      inventory,
      validatedSteps: { source: [], follow_up: [] },
      probeError: 'Element not found',
    });

    assert.match(text, /Last probe\/plan error: Element not found/);
    assert.doesNotMatch(text, /Last probe failure:/);
  });
});
