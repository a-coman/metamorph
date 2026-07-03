import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type {
  ExplorationCheckpointDto,
  LlmCallDto,
  ProbeStatusDto,
} from '@metamorph/api-client';
import {
  buildFamilyDisplayBuckets,
  buildSessionActivityByFamily,
  resolveDefaultActivitySelection,
  syncActivitySelection,
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
    assert.equal(permBucket.eventCount, 2);
    assert.equal(permBucket.cycles[0]?.plan?.id, 'llm-perm');
    assert.equal(permBucket.cycles[0]?.probe?.jobId, 'probe-perm');
  });

  it('interleaves session screenshots chronologically in family feed', () => {
    const screenshot = {
      id: 'ss-1',
      snapshotId: 'ss-1',
      jobId: 'discover-1',
      artifactId: 'art-1',
      url: 'https://example.com',
      createdAt: new Date('2026-01-01T12:00:02Z'),
    };

    const planPerm = makeLlm('llm-perm', {
      jobId: 'explore-perm',
      exploreJobId: 'explore-perm',
      mrVersionId: 'mr-perm',
      transformFamily: 'permutation',
      createdAt: new Date('2026-01-01T12:00:00Z'),
      updatedAt: new Date('2026-01-01T12:00:00Z'),
    });
    const probePerm = makeProbe('probe-perm', {
      planLlmCallId: 'llm-perm',
      mrVersionId: 'mr-perm',
      transformFamily: 'permutation',
      createdAt: new Date('2026-01-01T12:00:01Z'),
      startedAt: new Date('2026-01-01T12:00:01Z'),
      updatedAt: new Date('2026-01-01T12:00:01Z'),
    });

    const exploreJobs: ExploreJobAttributionMap = new Map([
      ['explore-perm', { mrVersionId: 'mr-perm', transformFamily: 'permutation' }],
    ]);

    const result = buildSessionActivityByFamily(
      {
        llmCalls: new Map([['llm-perm', planPerm]]),
        probes: new Map([['probe-perm', probePerm]]),
        screenshots: new Map([['ss-1', screenshot]]),
        checkpoints: new Map(),
        terminalExploreJobs: new Map(),
      },
      [...mrVersions],
      exploreJobs,
    );

    const permBucket = result.families.find((f) => f.family === 'permutation');
    assert.ok(permBucket);
    assert.equal(permBucket.eventCount, 3);

    const kinds = permBucket.feed.map((item) => {
      if (item.kind === 'cycle_step') return item.step;
      if (item.kind === 'standalone' && item.item.type === 'session_capture') {
        return 'screenshot';
      }
      return item.kind;
    });

    assert.deepEqual(kinds, ['plan', 'probe', 'screenshot']);
  });

  it('places family events before later session screenshots', () => {
    const screenshot = {
      id: 'ss-late',
      snapshotId: 'ss-late',
      jobId: 'discover-1',
      artifactId: 'art-1',
      url: 'https://example.com',
      createdAt: new Date('2026-01-01T12:00:05Z'),
    };

    const planPerm = makeLlm('llm-perm', {
      jobId: 'explore-perm',
      exploreJobId: 'explore-perm',
      mrVersionId: 'mr-perm',
      transformFamily: 'permutation',
      createdAt: new Date('2026-01-01T12:00:00Z'),
      updatedAt: new Date('2026-01-01T12:00:00Z'),
    });

    const exploreJobs: ExploreJobAttributionMap = new Map([
      ['explore-perm', { mrVersionId: 'mr-perm', transformFamily: 'permutation' }],
    ]);

    const result = buildSessionActivityByFamily(
      {
        llmCalls: new Map([['llm-perm', planPerm]]),
        probes: new Map(),
        screenshots: new Map([['ss-late', screenshot]]),
        checkpoints: new Map(),
        terminalExploreJobs: new Map(),
      },
      [...mrVersions],
      exploreJobs,
    );

    const permBucket = result.families.find((f) => f.family === 'permutation');
    assert.ok(permBucket);
    assert.equal(permBucket.feed[0]?.kind, 'cycle_step');
    if (permBucket.feed[0]?.kind === 'cycle_step') {
      assert.equal(permBucket.feed[0].step, 'plan');
    }
    assert.equal(permBucket.feed[1]?.kind, 'standalone');
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

const emptyState = {
  llmCalls: new Map(),
  probes: new Map(),
  screenshots: new Map(),
  checkpoints: new Map(),
  terminalExploreJobs: new Map(),
};

describe('buildFamilyDisplayBuckets', () => {
  it('returns queued placeholders for all transformFamilies when mrVersions is empty', () => {
    const buckets = buildFamilyDisplayBuckets(
      emptyState,
      [],
      ['permutation', 'idempotence', 'subset'],
    );

    assert.equal(buckets.length, 3);
    assert.deepEqual(
      buckets.map((bucket) => bucket.family),
      ['idempotence', 'subset', 'permutation'],
    );
    assert.ok(buckets.every((bucket) => bucket.isPending));
    assert.ok(buckets.every((bucket) => bucket.status === 'queued'));
    assert.ok(buckets.every((bucket) => bucket.mrVersionId === null));
    assert.ok(buckets.every((bucket) => bucket.eventCount === 0));
  });

  it('merges real buckets with pending placeholders', () => {
    const buckets = buildFamilyDisplayBuckets(
      emptyState,
      [{ id: 'mr-idem', status: 'exploring', transformFamily: 'idempotence' }],
      ['idempotence', 'subset'],
    );

    assert.equal(buckets.length, 2);
    assert.equal(buckets[0]?.family, 'idempotence');
    assert.equal(buckets[0]?.mrVersionId, 'mr-idem');
    assert.equal(buckets[0]?.isPending, undefined);
    assert.equal(buckets[1]?.family, 'subset');
    assert.equal(buckets[1]?.isPending, true);
  });
});

describe('resolveDefaultActivitySelection with transformFamilies', () => {
  it('picks the first sorted family when no mrVersions exist', () => {
    const selection = resolveDefaultActivitySelection([], ['permutation', 'idempotence']);

    assert.deepEqual(selection, { kind: 'family', family: 'idempotence' });
  });
});

describe('syncActivitySelection with transformFamilies', () => {
  it('keeps pending family selection valid across re-renders', () => {
    const current = { kind: 'family' as const, family: 'subset' };
    const synced = syncActivitySelection(current, [], ['subset', 'idempotence']);

    assert.deepEqual(synced, current);
  });

  it('upgrades pending selection when mrVersion arrives', () => {
    const current = { kind: 'family' as const, family: 'subset' };
    const synced = syncActivitySelection(
      current,
      [{ id: 'mr-inc', status: 'exploring', transformFamily: 'subset' }],
      ['subset'],
    );

    assert.deepEqual(synced, {
      kind: 'family',
      family: 'subset',
      mrVersionId: 'mr-inc',
    });
  });
});
