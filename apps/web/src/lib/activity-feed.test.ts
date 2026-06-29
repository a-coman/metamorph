import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  activityEventAtProbe,
  activitySortAtProbe,
  compareActivityTimeline,
  timelineSortKeyForCycleStep,
  timelineSortKeyForStandalone,
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

  it('activityEventAtProbe uses createdAt, not updatedAt', () => {
    const probe = {
      jobId: 'a',
      exploreJobId: null,
      planLlmCallId: null,
      cycleIteration: null,
      status: 'done' as const,
      mode: 'incremental' as const,
      phase: 'source',
      stepCount: 1,
      executedSteps: null,
      error: null,
      snapshotId: null,
      outputSnapshotId: null,
      createdAt: new Date('2026-06-13T19:13:59Z'),
      startedAt: new Date('2026-06-13T19:13:59Z'),
      updatedAt: new Date('2026-06-13T19:14:05Z'),
    };

    assert.equal(
      activityEventAtProbe(probe).getTime(),
      new Date('2026-06-13T19:13:59Z').getTime(),
    );
  });

  it('compareActivityTimeline sorts by eventAt then stepRank then id', () => {
    const plan = timelineSortKeyForCycleStep(
      'cycle-1',
      'plan',
      new Date('2026-06-13T10:00:00Z').getTime(),
    );
    const probe = timelineSortKeyForCycleStep(
      'cycle-1',
      'probe',
      new Date('2026-06-13T10:00:00Z').getTime(),
    );
    const standalone = timelineSortKeyForStandalone(
      'screenshot-1',
      new Date('2026-06-13T10:00:01Z').getTime(),
    );

    assert.ok(compareActivityTimeline(plan, probe) < 0);
    assert.ok(compareActivityTimeline(probe, standalone) < 0);
    assert.ok(compareActivityTimeline(plan, standalone) < 0);
  });

  it('compareActivityTimeline places verify_skipped after probe at same eventAt', () => {
    const at = new Date('2026-06-13T10:00:02Z').getTime();
    const probe = timelineSortKeyForCycleStep('cycle-1', 'probe', at);
    const skipped = timelineSortKeyForCycleStep('cycle-1', 'verify_skipped', at);

    assert.ok(compareActivityTimeline(probe, skipped) < 0);
  });
});
