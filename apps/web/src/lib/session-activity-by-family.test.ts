import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type {
  ExplorationCheckpointDto,
  LlmCallDto,
  ProbeStatusDto,
} from '@metamorph/api-client';
import {
  buildSessionActivityByFamily,
  type ExploreJobAttributionMap,
} from './session-activity-by-family';

const mrVersions = [
  { id: 'mr-idem', status: 'exploring', transformFamily: 'idempotence' },
  { id: 'mr-perm', status: 'exploring', transformFamily: 'permutation' },
] as const;

function makeLlm(
  id: string,
  overrides: Partial<LlmCallDto> = {},
): LlmCallDto {
  return {
    id,
    jobId: overrides.jobId ?? null,
    purpose: overrides.purpose ?? 'plan_explore',
    model: 'test',
    promptVersion: 'v1',
    systemPrompt: overrides.systemPrompt ?? null,
    userPrompt: overrides.userPrompt ?? null,
    userPromptImages: overrides.userPromptImages ?? null,
    status: overrides.status ?? 'done',
    tokensIn: null,
    tokensOut: null,
    latencyMs: null,
    responseJson: overrides.responseJson ?? { action: 'append_steps' },
    createdAt: new Date('2026-01-01T12:00:00Z'),
    updatedAt: new Date('2026-01-01T12:00:01Z'),
    ...overrides,
  };
}

function makeProbe(
  jobId: string,
  overrides: Partial<ProbeStatusDto> = {},
): ProbeStatusDto {
  return {
    jobId,
    exploreJobId: overrides.exploreJobId ?? 'explore-perm',
    planLlmCallId: overrides.planLlmCallId ?? null,
    cycleIteration: overrides.cycleIteration ?? 1,
    status: overrides.status ?? 'done',
    mode: 'incremental',
    phase: 'source',
    stepCount: 1,
    executedSteps: [{ id: 1, action: 'click', element_id: 'E1' }],
    error: null,
    snapshotId: null,
    outputSnapshotId: null,
    createdAt: new Date('2026-01-01T12:00:02Z'),
    startedAt: new Date('2026-01-01T12:00:02Z'),
    updatedAt: new Date('2026-01-01T12:00:03Z'),
    ...overrides,
  };
}

describe('buildSessionActivityByFamily', () => {
  it('splits interleaved llm and probe events by transform family', () => {
    const exploreJobs: ExploreJobAttributionMap = new Map([
      ['explore-idem', { mrVersionId: 'mr-idem', transformFamily: 'idempotence' }],
      ['explore-perm', { mrVersionId: 'mr-perm', transformFamily: 'permutation' }],
    ]);

    const planIdem = makeLlm('llm-idem', {
      jobId: 'explore-idem',
      exploreJobId: 'explore-idem',
      mrVersionId: 'mr-idem',
      transformFamily: 'idempotence',
    });
    const planPerm = makeLlm('llm-perm', {
      jobId: 'explore-perm',
      exploreJobId: 'explore-perm',
      mrVersionId: 'mr-perm',
      transformFamily: 'permutation',
    });
    const probePerm = makeProbe('probe-perm', {
      planLlmCallId: 'llm-perm',
      mrVersionId: 'mr-perm',
      transformFamily: 'permutation',
    });

    const result = buildSessionActivityByFamily(
      {
        llmCalls: new Map([
          [planIdem.id, planIdem],
          [planPerm.id, planPerm],
        ]),
        probes: new Map([['probe-perm', probePerm]]),
        screenshots: new Map(),
        checkpoints: new Map(),
        terminalExploreJobs: new Map(),
      },
      [...mrVersions],
      exploreJobs,
    );

    const idemBucket = result.families.find((f) => f.family === 'idempotence');
    const permBucket = result.families.find((f) => f.family === 'permutation');

    assert.ok(idemBucket);
    assert.ok(permBucket);
    assert.equal(idemBucket.eventCount, 1);
    assert.equal(permBucket.eventCount, 1);
    assert.equal(permBucket.cycles[0]?.plan?.id, 'llm-perm');
    assert.equal(permBucket.cycles[0]?.probe?.jobId, 'probe-perm');
  });

  it('prepends session screenshots to each family feed', () => {
    const screenshot = {
      id: 'ss-1',
      snapshotId: 'ss-1',
      jobId: 'discover-1',
      artifactId: 'art-1',
      url: 'https://example.com',
      createdAt: new Date('2026-01-01T11:59:00Z'),
    };

    const result = buildSessionActivityByFamily(
      {
        llmCalls: new Map(),
        probes: new Map(),
        screenshots: new Map([['ss-1', screenshot]]),
        checkpoints: new Map(),
        terminalExploreJobs: new Map(),
      },
      [...mrVersions],
      new Map(),
    );

    for (const bucket of result.families) {
      assert.equal(bucket.feed.length, 1);
      assert.equal(bucket.feed[0]?.kind, 'standalone');
      if (bucket.feed[0]?.kind === 'standalone') {
        assert.equal(bucket.feed[0].item.type, 'session_capture');
      }
      assert.equal(bucket.eventCount, 1);
    }
  });

  it('groups checkpoints by mrVersionId', () => {
    const checkpoint: ExplorationCheckpointDto = {
      id: 'cp-1',
      mrVersionId: 'mr-perm',
      phase: 'source',
      sequence: 1,
      snapshotId: 'snap-1',
      stepsJson: [],
      verdict: 'ok',
      rationale: 'ok',
      llmCallId: null,
      tracePath: null,
      traceArtifactId: null,
      createdAt: new Date('2026-01-01T12:00:04Z'),
    };

    const result = buildSessionActivityByFamily(
      {
        llmCalls: new Map(),
        probes: new Map(),
        screenshots: new Map(),
        checkpoints: new Map([['cp-1', checkpoint]]),
        terminalExploreJobs: new Map(),
      },
      [...mrVersions],
      new Map(),
    );

    const permBucket = result.families.find((f) => f.family === 'permutation');
    assert.ok(permBucket);
    assert.equal(permBucket.eventCount, 1);
  });
});
