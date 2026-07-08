import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  classifyReplayConsistency,
  type ReplayRunRecord,
} from './replay-consistency.js';

function run(overrides: Partial<ReplayRunRecord>): ReplayRunRecord {
  return {
    kind: 'replay',
    runId: 'run',
    status: 'completed',
    verdictStrict: 'pass',
    sourcePayloadHash: 'source',
    followUpPayloadHash: 'follow',
    ...overrides,
  };
}

describe('classifyReplayConsistency', () => {
  it('returns stable when all runs match', () => {
    const runs = [run({}), run({ runId: 'run-2' }), run({ runId: 'run-3' })];
    assert.equal(classifyReplayConsistency(runs), 'stable');
  });

  it('returns verdict_drift when hashes match but verdict differs', () => {
    const runs = [
      run({ verdictStrict: 'pass' }),
      run({ verdictStrict: 'fail' }),
      run({ verdictStrict: 'pass' }),
    ];
    assert.equal(classifyReplayConsistency(runs), 'verdict_drift');
  });

  it('returns observation_drift when verdict matches but hash differs', () => {
    const runs = [
      run({ sourcePayloadHash: 'a' }),
      run({ sourcePayloadHash: 'b' }),
      run({ sourcePayloadHash: 'a' }),
    ];
    assert.equal(classifyReplayConsistency(runs), 'observation_drift');
  });

  it('returns execute_failure when any run is incomplete', () => {
    const runs = [run({}), run({ status: 'failed' })];
    assert.equal(classifyReplayConsistency(runs), 'execute_failure');
  });
});
