import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { exploreJobDbPayloadSchema } from '../messages/llm-explore-job.message.js';

describe('exploreJobDbPayloadSchema', () => {
  it('requires transform_family in explore job payload', () => {
    const parsed = exploreJobDbPayloadSchema.safeParse({
      page_snapshot_id: '00000000-0000-4000-8000-000000000010',
      parent_discover_job_id: '00000000-0000-4000-8000-000000000011',
      transform_family: 'permutation',
    });

    assert.equal(parsed.success, true);
  });
});
