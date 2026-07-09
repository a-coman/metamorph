import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { playwrightProbeJobMessageSchema } from './playwright-probe-job.message.js';

describe('playwrightProbeJobMessageSchema', () => {
  it('parses slot steps through the shared core schema', () => {
    const parsed = playwrightProbeJobMessageSchema.safeParse({
      job_id: '00000000-0000-4000-8000-000000000020',
      session_id: '00000000-0000-4000-8000-000000000021',
      type: 'probe',
      mr_version_id: '00000000-0000-4000-8000-000000000022',
      payload: {
        explore_job_id: '00000000-0000-4000-8000-000000000023',
        phase: 'source',
        inventory_snapshot_id: '00000000-0000-4000-8000-000000000024',
        mode: 'incremental',
        validated_prefix: [
          {
            id: 1,
            action: 'goto',
            url: 'https://example.com',
          },
        ],
        probe_steps: [
          {
            id: 2,
            action: 'click',
            element_id: 'E1',
          },
        ],
        resume_url: 'https://example.com',
      },
    });

    assert.equal(parsed.success, true);
  });
});
