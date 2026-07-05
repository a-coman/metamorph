import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { resolvePipelineStepStates } from './session-pipeline.ts';

const approvedMr = {
  id: 'mr-1',
  status: 'approved',
  transformFamily: 'subset',
};

describe('resolvePipelineStepStates', () => {
  it('marks all steps done for a single approved MR (per-family stepper)', () => {
    const states = resolvePipelineStepStates(approvedMr, [approvedMr], []);
    assert.deepEqual(states, ['done', 'done', 'done', 'done']);
  });

  it('marks all steps done when every session MR is approved', () => {
    const mrs = [
      { id: '1', status: 'approved', transformFamily: 'idempotence' },
      { id: '2', status: 'approved', transformFamily: 'subset' },
      { id: '3', status: 'approved', transformFamily: 'permutation' },
      { id: '4', status: 'approved', transformFamily: 'inverse' },
    ];
    const states = resolvePipelineStepStates(mrs[0], mrs, []);
    assert.deepEqual(states, ['done', 'done', 'done', 'done']);
  });

  it('keeps review active when one MR is still pending HITL', () => {
    const mrs = [
      { id: '1', status: 'approved', transformFamily: 'idempotence' },
      { id: '2', status: 'draft_pending_hitl', transformFamily: 'subset' },
    ];
    const states = resolvePipelineStepStates(mrs[1], mrs, []);
    assert.deepEqual(states, ['done', 'done', 'active', 'pending']);
  });
});
