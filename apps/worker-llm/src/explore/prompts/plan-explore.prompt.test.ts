import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { buildPlanExploreUserText } from './plan-explore.prompt.js';
import type { MrIntent } from '@metamorph/core';
import type { ExploreBatchLog } from '../infrastructure/graph/explore-state.js';

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

const batchLog: ExploreBatchLog = {
  source: [
    {
      batch: 1,
      outcome: 'committed',
      steps: [{ id: 1, action: 'click', element_id: 'E04' }],
    },
    {
      batch: 2,
      outcome: 'probe_failed',
      error: 'Timeout waiting for locator',
      failedStep: {
        id: 2,
        action: 'click',
        element_id: 'E01',
        resolved_locator: "getByTestId('search-button')",
      },
      screenshotBeforeSnapshotId: '00000000-0000-4000-8000-000000000001',
      steps: [
        { id: 2, action: 'fill', element_id: 'E01', value: 'laptop' },
        { id: 3, action: 'click', element_id: 'E02' },
      ],
    },
    {
      batch: 3,
      outcome: 'plan_rejected',
      error: 'fill not allowed on E46',
      steps: [{ id: 3, action: 'fill', element_id: 'E46', value: 'London' }],
    },
  ],
  follow_up: [],
};

describe('buildPlanExploreUserText batch log', () => {
  it('includes exploration history, validated batches, and all errors', () => {
    const text = buildPlanExploreUserText({
      url: 'https://www.example.com/',
      phase: 'source',
      mrIntent,
      inventory,
      batchLog,
      latestProbeFailureBatch: 2,
    });

    assert.match(text, /Exploration history/);
    assert.match(text, /Batch 1 \(committed\)/);
    assert.match(text, /Validated batches/);
    assert.match(text, /Batch 2 — Probe failed/);
    assert.match(text, /Timeout waiting for locator/);
    assert.match(text, /Batch 3 — Plan rejected/);
    assert.match(text, /fill not allowed on E46/);
    assert.match(text, /1\. Current inventory screenshot/);
    assert.match(text, /2\. Probe failure context \(Batch 2\)/);
    assert.doesNotMatch(text, /Last probe failure:/);
  });

  it('uses a single screenshot attachment when there is no probe failure image', () => {
    const text = buildPlanExploreUserText({
      url: 'https://www.example.com/',
      phase: 'source',
      mrIntent,
      inventory,
      batchLog: { source: [], follow_up: [] },
    });

    assert.match(text, /Attached: annotated screenshot/);
    assert.match(text, /Errors \(do not repeat these failed approaches\):/);
    assert.match(text, /\(none yet\)/);
  });
});
