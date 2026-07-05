import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { LlmCallDto, ProbeStatusDto } from '@metamorph/api-client';
import { buildExplorationCycles, buildTimelineFeed } from './exploration-cycles';

function planLlm(
  id: string,
  action: string,
  createdAt: string,
): LlmCallDto {
  return {
    id,
    jobId: 'explore-1',
    purpose: 'plan_explore',
    model: 'test/model',
    promptVersion: 'v1',
    systemPrompt: null,
    userPrompt: null,
    userPromptImages: null,
    status: 'done',
    tokensIn: 1,
    tokensOut: 1,
    latencyMs: 100,
    responseJson: { action },
    createdAt: new Date(createdAt),
    updatedAt: new Date(createdAt),
  };
}

function verifyLlm(id: string, createdAt: string): LlmCallDto {
  return {
    id,
    jobId: 'explore-1',
    purpose: 'explore_verify',
    model: 'test/model',
    promptVersion: 'v1',
    systemPrompt: null,
    userPrompt: null,
    userPromptImages: null,
    status: 'done',
    tokensIn: 1,
    tokensOut: 1,
    latencyMs: 100,
    responseJson: { verdict: 'ok' },
    createdAt: new Date(createdAt),
    updatedAt: new Date(createdAt),
  };
}

function probe(
  jobId: string,
  createdAt: string,
  overrides: Partial<ProbeStatusDto> = {},
): ProbeStatusDto {
  return {
    jobId,
    exploreJobId: 'explore-1',
    planLlmCallId: null,
    cycleIteration: null,
    status: 'done',
    mode: 'incremental',
    phase: 'source',
    stepCount: 1,
    executedSteps: [],
    error: null,
    snapshotId: null,
    outputSnapshotId: null,
    createdAt: new Date(createdAt),
    startedAt: new Date(createdAt),
    updatedAt: new Date(createdAt),
    ...overrides,
  };
}

describe('exploration-cycles', () => {
  it('builds incremental plan → probe → verify cycle', () => {
    const plan = planLlm('plan-1', 'append_steps', '2026-06-13T10:00:00Z');
    const result = buildExplorationCycles({
      llmCalls: new Map([
        ['plan-1', plan],
        ['verify-1', verifyLlm('verify-1', '2026-06-13T10:00:05Z')],
      ]),
      probes: new Map([
        ['probe-1', probe('probe-1', '2026-06-13T10:00:02Z', { planLlmCallId: 'plan-1' })],
      ]),
      screenshots: new Map(),
      checkpoints: new Map(),
    });

    assert.equal(result.cycles.length, 1);
    assert.equal(result.cycles[0]?.kind, 'incremental');
    assert.equal(result.cycles[0]?.plan?.id, 'plan-1');
    assert.equal(result.cycles[0]?.probe?.jobId, 'probe-1');
    assert.equal(result.cycles[0]?.verify?.id, 'verify-1');
  });

  it('marks probe failed cycles with verify skipped', () => {
    const result = buildExplorationCycles({
      llmCalls: new Map([
        ['plan-1', planLlm('plan-1', 'append_steps', '2026-06-13T10:00:00Z')],
      ]),
      probes: new Map([
        [
          'probe-1',
          probe('probe-1', '2026-06-13T10:00:02Z', {
            planLlmCallId: 'plan-1',
            status: 'failed',
          }),
        ],
      ]),
      screenshots: new Map(),
      checkpoints: new Map(),
    });

    assert.equal(result.cycles[0]?.verifySkipped, 'probe_failed');
    assert.equal(result.cycles[0]?.verify, undefined);
  });

  it('builds goal_complete without probe or verify', () => {
    const result = buildExplorationCycles({
      llmCalls: new Map([
        ['plan-1', planLlm('plan-1', 'scenario_complete', '2026-06-13T10:00:00Z')],
      ]),
      probes: new Map(),
      screenshots: new Map(),
      checkpoints: new Map(),
    });

    assert.equal(result.cycles.length, 1);
    assert.equal(result.cycles[0]?.kind, 'goal_complete');
    assert.equal(result.cycles[0]?.probe, undefined);
    assert.equal(result.cycles[0]?.verify, undefined);
  });

  it('links smoke probe to scenario_complete plan via planLlmCallId', () => {
    const result = buildExplorationCycles({
      llmCalls: new Map([
        ['plan-inc', planLlm('plan-inc', 'append_steps', '2026-06-13T09:00:00Z')],
        ['plan-goal', planLlm('plan-goal', 'scenario_complete', '2026-06-13T10:00:00Z')],
      ]),
      probes: new Map([
        ['probe-inc', probe('probe-inc', '2026-06-13T09:00:02Z', { planLlmCallId: 'plan-inc' })],
        [
          'probe-smoke',
          probe('probe-smoke', '2026-06-13T10:00:05Z', {
            mode: 'smoke_replay',
            planLlmCallId: 'plan-goal',
          }),
        ],
      ]),
      screenshots: new Map(),
      checkpoints: new Map(),
    });

    const smoke = result.cycles.find((cycle) => cycle.kind === 'smoke');
    assert.ok(smoke);
    assert.equal(smoke.probe?.jobId, 'probe-smoke');
    assert.equal(smoke.plan?.id, 'plan-goal');
  });

  it('does not attach append_steps plan to smoke when planLlmCallId is not scenario_complete', () => {
    const result = buildExplorationCycles({
      llmCalls: new Map([
        ['plan-inc', planLlm('plan-inc', 'append_steps', '2026-06-13T09:00:00Z')],
      ]),
      probes: new Map([
        [
          'probe-smoke',
          probe('probe-smoke', '2026-06-13T10:00:05Z', {
            mode: 'smoke_replay',
            planLlmCallId: 'plan-inc',
          }),
        ],
      ]),
      screenshots: new Map(),
      checkpoints: new Map(),
    });

    const smoke = result.cycles.find((cycle) => cycle.kind === 'smoke');
    assert.ok(smoke);
    assert.equal(smoke.plan, undefined);
  });

  it('builds plan_recovery cycles for consecutive failed plans', () => {
    const result = buildExplorationCycles({
      llmCalls: new Map([
        ['plan-1', planLlm('plan-1', 'append_steps', '2026-06-13T10:00:00Z')],
        ['plan-2', planLlm('plan-2', 'append_steps', '2026-06-13T10:00:03Z')],
      ]),
      probes: new Map(),
      screenshots: new Map(),
      checkpoints: new Map(),
    });

    const recoveries = result.cycles.filter((cycle) => cycle.kind === 'plan_recovery');
    assert.equal(recoveries.length, 2);
  });

  it('falls back to temporal linking without planLlmCallId metadata', () => {
    const result = buildExplorationCycles({
      llmCalls: new Map([
        ['plan-1', planLlm('plan-1', 'append_steps', '2026-06-13T10:00:00Z')],
        ['verify-1', verifyLlm('verify-1', '2026-06-13T10:00:05Z')],
      ]),
      probes: new Map([
        ['probe-1', probe('probe-1', '2026-06-13T10:00:02Z')],
      ]),
      screenshots: new Map(),
      checkpoints: new Map(),
    });

    assert.equal(result.cycles[0]?.plan?.id, 'plan-1');
    assert.equal(result.cycles[0]?.probe?.jobId, 'probe-1');
    assert.equal(result.cycles[0]?.verify?.id, 'verify-1');
  });

  it('marks graph_interrupted when explore job failed without verify', () => {
    const terminalExploreJobs = new Map<string, 'done' | 'failed'>([
      ['explore-1', 'failed'],
    ]);
    const result = buildExplorationCycles({
      llmCalls: new Map([
        ['plan-1', planLlm('plan-1', 'append_steps', '2026-06-13T10:00:00Z')],
      ]),
      probes: new Map([
        [
          'probe-1',
          probe('probe-1', '2026-06-13T10:00:02Z', {
            planLlmCallId: 'plan-1',
            status: 'done',
          }),
        ],
      ]),
      screenshots: new Map(),
      checkpoints: new Map(),
      terminalExploreJobs,
    });

    assert.equal(result.cycles[0]?.verifySkipped, 'graph_interrupted');
  });
});

describe('buildTimelineFeed', () => {
  it('orders incremental cycle steps plan → probe → verify by createdAt', () => {
    const { cycles, standalone } = buildExplorationCycles({
      llmCalls: new Map([
        ['plan-1', planLlm('plan-1', 'append_steps', '2026-06-13T10:00:00Z')],
        ['verify-1', verifyLlm('verify-1', '2026-06-13T10:00:05Z')],
      ]),
      probes: new Map([
        ['probe-1', probe('probe-1', '2026-06-13T10:00:02Z', { planLlmCallId: 'plan-1' })],
      ]),
      screenshots: new Map(),
      checkpoints: new Map(),
    });

    const feed = buildTimelineFeed(cycles, standalone);
    const steps = feed
      .filter((item) => item.kind === 'cycle_step')
      .map((item) => item.step);

    assert.deepEqual(steps, ['plan', 'probe', 'verify']);
  });

  it('places session screenshot between probe and verify by createdAt', () => {
    const { cycles, standalone } = buildExplorationCycles({
      llmCalls: new Map([
        ['plan-1', planLlm('plan-1', 'append_steps', '2026-06-13T20:40:55Z')],
        [
          'verify-1',
          {
            ...verifyLlm('verify-1', '2026-06-13T20:41:16Z'),
            updatedAt: new Date('2026-06-13T20:41:27Z'),
          },
        ],
      ]),
      probes: new Map([
        [
          'probe-1',
          {
            ...probe('probe-1', '2026-06-13T20:40:58Z', { planLlmCallId: 'plan-1' }),
            updatedAt: new Date('2026-06-13T20:41:10Z'),
          },
        ],
      ]),
      screenshots: new Map([
        [
          'ss-1',
          {
            id: 'ss-1',
            snapshotId: 'ss-1',
            jobId: 'discover-1',
            artifactId: 'art-1',
            url: 'https://example.com',
            createdAt: new Date('2026-06-13T20:41:01Z'),
          },
        ],
      ]),
      checkpoints: new Map(),
    });

    const feed = buildTimelineFeed(cycles, standalone);
    const kinds = feed.map((item) => {
      if (item.kind === 'cycle_step') return item.step;
      if (item.kind === 'standalone' && item.item.type === 'session_capture') {
        return 'screenshot';
      }
      return item.kind;
    });

    assert.deepEqual(kinds, ['plan', 'probe', 'screenshot', 'verify']);
  });

  it('places verify_skipped after probe when createdAt matches', () => {
    const at = '2026-06-13T10:00:02Z';
    const { cycles, standalone } = buildExplorationCycles({
      llmCalls: new Map([
        ['plan-1', planLlm('plan-1', 'append_steps', '2026-06-13T10:00:00Z')],
      ]),
      probes: new Map([
        [
          'probe-1',
          probe('probe-1', at, {
            planLlmCallId: 'plan-1',
            status: 'failed',
          }),
        ],
      ]),
      screenshots: new Map(),
      checkpoints: new Map(),
    });

    const feed = buildTimelineFeed(cycles, standalone);
    const steps = feed
      .filter((item) => item.kind === 'cycle_step')
      .map((item) => item.step);

    assert.deepEqual(steps, ['plan', 'probe', 'verify_skipped']);
  });

  it('shows scenario_complete plan before smoke replay in timeline', () => {
    const { cycles, standalone } = buildExplorationCycles({
      llmCalls: new Map([
        ['plan-goal', planLlm('plan-goal', 'scenario_complete', '2026-06-13T10:00:00Z')],
      ]),
      probes: new Map([
        [
          'probe-smoke',
          probe('probe-smoke', '2026-06-13T10:00:05Z', {
            mode: 'smoke_replay',
            planLlmCallId: 'plan-goal',
          }),
        ],
      ]),
      screenshots: new Map(),
      checkpoints: new Map(),
    });

    const feed = buildTimelineFeed(cycles, standalone);
    const steps = feed
      .filter((item) => item.kind === 'cycle_step')
      .map((item) => item.step);

    assert.deepEqual(steps, ['plan', 'probe']);
  });

  it('inserts source phase divider after mr_plan standalone', () => {
    const mrPlan: LlmCallDto = {
      id: 'mr-plan-1',
      jobId: null,
      purpose: 'mr_plan',
      model: 'test/model',
      promptVersion: 'v1',
      systemPrompt: null,
      userPrompt: null,
      userPromptImages: null,
      status: 'done',
      tokensIn: 1,
      tokensOut: 1,
      latencyMs: 100,
      responseJson: { exploration: {} },
      createdAt: new Date('2026-06-13T09:00:00Z'),
      updatedAt: new Date('2026-06-13T09:00:00Z'),
    };

    const { cycles, standalone } = buildExplorationCycles({
      llmCalls: new Map([['mr-plan-1', mrPlan]]),
      probes: new Map(),
      screenshots: new Map(),
      checkpoints: new Map(),
    });

    const feed = buildTimelineFeed(cycles, standalone);
    assert.equal(feed[0]?.kind, 'standalone');
    assert.equal(feed[1]?.kind, 'phase_divider');
    if (feed[1]?.kind === 'phase_divider') {
      assert.equal(feed[1].phase, 'source');
    }
  });

  it('defers checkpoint_orphan until linked explore_verify LLM is in state', () => {
    const checkpoint = {
      id: 'cp-1',
      mrVersionId: 'mr-1',
      phase: 'source',
      sequence: 1,
      snapshotId: 'snap-1',
      stepsJson: [],
      verdict: 'ok',
      rationale: null,
      llmCallId: 'verify-1',
      tracePath: null,
      traceArtifactId: null,
      createdAt: new Date('2026-06-13T10:00:04Z'),
    };

    const withoutVerify = buildExplorationCycles({
      llmCalls: new Map(),
      probes: new Map(),
      screenshots: new Map(),
      checkpoints: new Map([['cp-1', checkpoint]]),
    });
    assert.equal(
      withoutVerify.standalone.filter((item) => item.type === 'checkpoint_orphan').length,
      0,
    );

    const withVerify = buildExplorationCycles({
      llmCalls: new Map([['verify-1', verifyLlm('verify-1', '2026-06-13T10:00:04Z')]]),
      probes: new Map(),
      screenshots: new Map(),
      checkpoints: new Map([['cp-1', checkpoint]]),
    });
    assert.equal(withVerify.cycles.length, 1);
    assert.equal(withVerify.cycles[0]?.verify?.id, 'verify-1');
    assert.equal(withVerify.cycles[0]?.checkpoint?.id, 'cp-1');
    assert.equal(
      withVerify.standalone.filter((item) => item.type === 'checkpoint_orphan').length,
      0,
    );
  });
});
