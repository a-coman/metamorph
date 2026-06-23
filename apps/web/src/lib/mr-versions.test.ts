import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  aggregateMrPipelineStatus,
  sortMrVersionsByFamily,
} from './mr-versions.ts';

describe('mr-versions', () => {
  it('sorts families in canonical order', () => {
    const sorted = sortMrVersionsByFamily([
      { id: '4', status: 'exploring', transformFamily: 'inverse' },
      { id: '1', status: 'exploring', transformFamily: 'idempotence' },
      { id: '2', status: 'exploring', transformFamily: 'inclusion' },
    ]);

    assert.deepEqual(
      sorted.map((mr) => mr.transformFamily),
      ['idempotence', 'inclusion', 'inverse'],
    );
  });

  it('aggregates exploring status when any MR is exploring', () => {
    const aggregate = aggregateMrPipelineStatus([
      { id: '1', status: 'draft_pending_hitl', transformFamily: 'idempotence' },
      { id: '2', status: 'exploring', transformFamily: 'inclusion' },
    ]);

    assert.equal(aggregate?.id, '2');
  });
});
