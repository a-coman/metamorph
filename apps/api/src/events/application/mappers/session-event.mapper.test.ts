import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { JobStatus, JobType } from '../../../../generated/prisma/enums.js';
import { buildJobAttributionContext } from './explore-job-attribution.js';
import { mapLlmCallDto, mapProbeDto } from './session-event.mapper.js';

describe('session-event attribution mappers', () => {
  const mrFamilies = new Map([
    ['mr-perm', 'permutation'],
    ['mr-idem', 'idempotence'],
  ]);

  const jobs = [
    {
      id: 'explore-perm',
      type: JobType.explore,
      mrVersionId: 'mr-perm',
      payload: { transform_family: 'permutation' },
    },
    {
      id: 'explore-idem',
      type: JobType.explore,
      mrVersionId: 'mr-idem',
      payload: { transform_family: 'idempotence' },
    },
    {
      id: 'probe-1',
      type: JobType.probe,
      mrVersionId: null,
      payload: {
        explore_job_id: 'explore-perm',
        plan_llm_call_id: 'llm-plan',
        cycle_iteration: 2,
      },
    },
  ];

  const context = buildJobAttributionContext(jobs, mrFamilies);

  it('mapProbeDto resolves mrVersionId and transformFamily from explore job', () => {
    const probe = mapProbeDto(
      {
        job: {
          id: 'probe-1',
          status: JobStatus.done,
          payload: jobs[2].payload,
          createdAt: new Date('2026-01-01T12:00:00Z'),
          startedAt: new Date('2026-01-01T12:00:01Z'),
          finishedAt: new Date('2026-01-01T12:00:05Z'),
          errorMessage: null,
        },
        outputSnapshotId: 'snap-1',
      },
      context,
    );

    assert.equal(probe.exploreJobId, 'explore-perm');
    assert.equal(probe.mrVersionId, 'mr-perm');
    assert.equal(probe.transformFamily, 'permutation');
  });

  it('mapLlmCallDto resolves explore job attribution', () => {
    const llm = mapLlmCallDto(
      {
        id: 'llm-1',
        jobId: 'explore-idem',
        mrVersionId: null,
        purpose: 'plan_explore',
        model: 'test',
        promptVersion: 'v1',
        systemPrompt: null,
        userPrompt: null,
        userPromptImages: null,
        tokensIn: 100,
        tokensOut: 50,
        latencyMs: 200,
        responseJson: { action: 'append_steps' },
        createdAt: new Date('2026-01-01T12:00:00Z'),
        completedAt: new Date('2026-01-01T12:00:02Z'),
        updatedAt: new Date('2026-01-01T12:00:02Z'),
      },
      context,
    );

    assert.equal(llm.exploreJobId, 'explore-idem');
    assert.equal(llm.mrVersionId, 'mr-idem');
    assert.equal(llm.transformFamily, 'idempotence');
  });
});
