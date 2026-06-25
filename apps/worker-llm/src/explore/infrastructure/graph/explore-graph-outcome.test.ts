import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { interpretExploreGraphOutcome } from './explore-graph-outcome.js';

describe('interpretExploreGraphOutcome', () => {
  it('returns failed from checkpoint values when invoke result omits failed', () => {
    const outcome = interpretExploreGraphOutcome(
      { mrVersionId: 'mr-1' },
      {
        next: [],
        values: { failed: true, failureReason: 'compile failed', mrVersionId: 'mr-1' },
      },
    );

    assert.equal(outcome.status, 'failed');
    assert.equal(outcome.reason, 'compile failed');
  });

  it('returns interrupted when invoke exposes __interrupt__ but next is empty', () => {
    const outcome = interpretExploreGraphOutcome(
      {
        mrVersionId: 'mr-1',
        __interrupt__: [{ value: { probeJobId: 'probe-1' } }],
      },
      { next: [] },
    );

    assert.equal(outcome.status, 'interrupted');
    assert.equal(outcome.mrVersionId, 'mr-1');
  });

  it('returns interrupted when snapshot.interrupts is populated', () => {
    const outcome = interpretExploreGraphOutcome(
      { mrVersionId: 'mr-1' },
      {
        next: [],
        interrupts: [{ value: { probeJobId: 'probe-1' } }],
      },
    );

    assert.equal(outcome.status, 'interrupted');
  });

  it('returns paused for user_pause interrupts', () => {
    const outcome = interpretExploreGraphOutcome(
      { __interrupt__: [{ value: { reason: 'user_pause' } }] },
      { next: ['await_probe'] },
    );

    assert.equal(outcome.status, 'paused');
  });

  it('returns completed when graph reached END with no pending interrupts', () => {
    const outcome = interpretExploreGraphOutcome(
      { mrVersionId: 'mr-1' },
      { next: [], values: { mrVersionId: 'mr-1' } },
    );

    assert.equal(outcome.status, 'completed');
  });
});
