import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { llmExploreResumeMessageSchema } from '../messages/llm-explore-job.message.js';

describe('llmExploreResumeMessageSchema', () => {
  it('parses resume without failure_context', () => {
    const parsed = llmExploreResumeMessageSchema.safeParse({
      job_id: '00000000-0000-4000-8000-000000000010',
      session_id: '00000000-0000-4000-8000-000000000011',
      type: 'explore_resume',
      explore_job_id: '00000000-0000-4000-8000-000000000010',
      payload: {
        probe_job_id: '00000000-0000-4000-8000-000000000012',
        snapshot_id: null,
        probe_status: 'failed',
        error: 'Timeout',
      },
    });

    assert.equal(parsed.success, true);
  });

  it('parses resume with failure_context', () => {
    const parsed = llmExploreResumeMessageSchema.safeParse({
      job_id: '00000000-0000-4000-8000-000000000010',
      session_id: '00000000-0000-4000-8000-000000000011',
      type: 'explore_resume',
      explore_job_id: '00000000-0000-4000-8000-000000000010',
      payload: {
        probe_job_id: '00000000-0000-4000-8000-000000000012',
        snapshot_id: '00000000-0000-4000-8000-000000000013',
        probe_status: 'failed',
        error: 'Timeout',
        failure_context: {
          failed_step: {
            id: 2,
            action: 'click',
            element_id: 'E1',
            resolved_locator: "getByTestId('search-button')",
          },
          failed_step_index: 3,
          failed_batch_index: 1,
          failed_batch_size: 2,
          url_before_failure: 'https://www.example.com/listings',
          screenshot_before_snapshot_id: '00000000-0000-4000-8000-000000000014',
        },
      },
    });

    assert.equal(parsed.success, true);
    if (parsed.success) {
      assert.equal(parsed.data.payload.failure_context?.failed_batch_index, 1);
    }
  });
});
