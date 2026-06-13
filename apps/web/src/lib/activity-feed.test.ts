import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  activitySortAtProbe,
} from './activity-feed';

describe('activity-feed', () => {
  it('activitySortAtProbe uses immutable createdAt, not updatedAt', () => {
    const running = {
      jobId: 'a',
      exploreJobId: null,
      planLlmCallId: null,
      cycleIteration: null,
      status: 'running' as const,
      mode: 'incremental' as const,
      phase: 'source',
      stepCount: 2,
      executedSteps: null,
      error: null,
      snapshotId: null,
      outputSnapshotId: null,
      createdAt: new Date('2026-06-13T19:13:59Z'),
      startedAt: new Date('2026-06-13T19:13:59Z'),
      updatedAt: new Date('2026-06-13T19:13:59Z'),
    };
    const doneLater = {
      ...running,
      jobId: 'b',
      status: 'done' as const,
      createdAt: new Date('2026-06-13T19:14:00Z'),
      startedAt: new Date('2026-06-13T19:14:00Z'),
      updatedAt: new Date('2026-06-13T19:14:05Z'),
    };

    assert.ok(activitySortAtProbe(running) < activitySortAtProbe(doneLater));

    const runningSort = activitySortAtProbe(running);
    const doneWithEarlyCreated = {
      ...doneLater,
      createdAt: new Date('2026-06-13T19:13:58Z'),
      updatedAt: new Date('2026-06-13T19:14:05Z'),
    };
    assert.ok(runningSort > activitySortAtProbe(doneWithEarlyCreated));
  });
});
