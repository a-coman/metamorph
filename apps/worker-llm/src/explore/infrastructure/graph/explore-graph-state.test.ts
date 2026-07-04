import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it } from 'node:test';
import type { SlotStep } from '@metamorph/core';

/** Mirrors the LangGraph reducer for pendingProbeSteps. */
export function mergePendingProbeSteps(_: SlotStep[], update: SlotStep[]): SlotStep[] {
  return update;
}

const graphSourcePath = join(
  dirname(fileURLToPath(import.meta.url)),
  'explore-graph.ts',
);

describe('explore-graph pendingProbeSteps', () => {
  it('reducer uses last-write-wins', () => {
    const previous: SlotStep[] = [{ id: 1, action: 'click', element_id: 'E1' }];
    const cleared: SlotStep[] = [];
    const next: SlotStep[] = [{ id: 2, action: 'fill', element_id: 'E2', value: 'x' }];

    assert.deepEqual(mergePendingProbeSteps(previous, cleared), []);
    assert.deepEqual(mergePendingProbeSteps(previous, next), next);
  });

  it('does not clear pendingProbeSteps in await_probe returns', () => {
    const source = readFileSync(graphSourcePath, 'utf8');
    const awaitProbeStart = source.indexOf('async function awaitProbeNode');
    const assessCheckpointStart = source.indexOf('async function assessCheckpointNode');
    assert.ok(awaitProbeStart >= 0);
    assert.ok(assessCheckpointStart > awaitProbeStart);

    const awaitProbeBody = source.slice(awaitProbeStart, assessCheckpointStart);
    assert.equal(
      awaitProbeBody.includes('pendingProbeSteps: []'),
      false,
      'await_probe must not clear pendingProbeSteps',
    );
  });

  it('clears pendingProbeSteps via afterAssessCheckpoint helper', () => {
    const source = readFileSync(graphSourcePath, 'utf8');
    assert.ok(source.includes('function afterAssessCheckpoint'));
    assert.ok(source.includes('pendingProbeSteps: []'));
    assert.ok(source.includes('return afterAssessCheckpoint({'));
  });

  it('does not splice validatedSteps on probe or checkpoint failure', () => {
    const source = readFileSync(graphSourcePath, 'utf8');
    const commitStart = source.indexOf('async function commitOrBacktrackNode');
    const dispatchSmokeStart = source.indexOf('async function dispatchSmokeNode');
    assert.ok(commitStart >= 0);
    assert.ok(dispatchSmokeStart > commitStart);

    const commitBody = source.slice(commitStart, dispatchSmokeStart);
    const failBranchStart = commitBody.indexOf("if (state.lastVerdict === 'fail')");
    assert.ok(failBranchStart >= 0);

    const failBranch = commitBody.slice(failBranchStart);
    assert.equal(
      failBranch.includes('validatedSteps[phase].splice'),
      false,
      'commit fail must not remove committed steps from validatedSteps',
    );
    assert.equal(
      failBranch.includes('current.splice'),
      false,
      'commit fail must not splice a backtracked copy of validatedSteps',
    );
    assert.match(failBranch, /revert snapshot/);
    assert.match(failBranch, /revertedSnapshotId/);
  });

  it('observe_spec falls back to currentSnapshotId before switch_phase', () => {
    const source = readFileSync(graphSourcePath, 'utf8');
    const observeStart = source.indexOf('async function observeSpecNode');
    const switchPhaseStart = source.indexOf('async function switchPhaseNode');
    assert.ok(observeStart >= 0);
    assert.ok(switchPhaseStart > observeStart);

    const observeBody = source.slice(observeStart, switchPhaseStart);
    assert.match(
      observeBody,
      /sourceEndSnapshotId\s*\?\?\s*state\.currentSnapshotId/,
      'observe_spec must use currentSnapshotId when sourceEndSnapshotId is unset',
    );
  });

  it('observe_spec validates number_index and family compare constraints', () => {
    const source = readFileSync(graphSourcePath, 'utf8');
    const observeStart = source.indexOf('async function observeSpecNode');
    const switchPhaseStart = source.indexOf('async function switchPhaseNode');
    assert.ok(observeStart >= 0);
    assert.ok(switchPhaseStart > observeStart);

    const observeBody = source.slice(observeStart, switchPhaseStart);
    assert.match(observeBody, /validateObserveSpecOutput/);
    assert.match(observeBody, /parseLocalizedNumbers/);
    assert.match(observeBody, /number_index/);
    assert.match(observeBody, /MIN_RESULT_LABEL_ELEMENT_AREA_PX/);
    assert.match(observeBody, /isCompareAllowedForFamily/);
    assert.match(observeBody, /loadRawBase64/);
    assert.match(observeBody, /requireObservationItems/);
    assert.match(observeBody, /resolveObservableBindingTargets/);
  });

  it('routes source smoke success to observe_spec before switch_phase', () => {
    const source = readFileSync(graphSourcePath, 'utf8');
    assert.match(
      source,
      /function routeAfterGoalReached[\s\S]*!state\.observationSpec[\s\S]*return 'observe_spec'/,
    );
    assert.match(source, /addNode\('observe_spec', observeSpecNode\)/);
  });

  it('assess_checkpoint retries retryable verify LLM errors without setting lastVerdict fail', () => {
    const source = readFileSync(graphSourcePath, 'utf8');
    const assessStart = source.indexOf('async function assessCheckpointNode');
    const commitStart = source.indexOf('async function commitOrBacktrackNode');
    assert.ok(assessStart >= 0);
    assert.ok(commitStart > assessStart);

    const assessBody = source.slice(assessStart, commitStart);
    assert.match(assessBody, /isRetryableVerifyLlmError/);
    assert.match(assessBody, /withVerifyRejection/);
    assert.match(assessBody, /verify→retry/);

    const retryBranch = assessBody.slice(assessBody.indexOf('isRetryableVerifyLlmError'));
    const retryCatchEnd = retryBranch.indexOf('logExploreGraphEvent(\n        `iter=');
    assert.ok(retryCatchEnd > 0);
    const retryOnly = retryBranch.slice(0, retryCatchEnd);
    assert.equal(retryOnly.includes("lastVerdict: 'fail'"), false);
  });

  it('assess_checkpoint fails exploration when verify recovery attempts are exhausted', () => {
    const source = readFileSync(graphSourcePath, 'utf8');
    const assessStart = source.indexOf('async function assessCheckpointNode');
    const commitStart = source.indexOf('async function commitOrBacktrackNode');
    assert.ok(assessStart >= 0);
    assert.ok(commitStart > assessStart);

    const assessBody = source.slice(assessStart, commitStart);
    assert.match(
      assessBody,
      /verifyRecoveryAttempts >= state\.maxVerifyRecoveryAttempts/,
    );
    assert.match(assessBody, /Max verify recovery attempts/);
  });

  it('routeAfterAssessCheckpoint loops back to assess_checkpoint on verify infra retry', () => {
    const source = readFileSync(graphSourcePath, 'utf8');
    assert.match(source, /function routeAfterAssessCheckpoint/);
    assert.match(
      source,
      /!state\.lastVerdict && state\.verifyRecoveryAttempts > 0[\s\S]*return 'assess_checkpoint'/,
    );
    assert.match(
      source,
      /addConditionalEdges\('assess_checkpoint', routeAfterAssessCheckpoint/,
    );
    assert.equal(source.includes(".addEdge('assess_checkpoint', 'commit_or_backtrack')"), false);
  });

  it('verify infra retry path does not revert snapshot in assess_checkpoint', () => {
    const source = readFileSync(graphSourcePath, 'utf8');
    const assessStart = source.indexOf('async function assessCheckpointNode');
    const commitStart = source.indexOf('async function commitOrBacktrackNode');
    assert.ok(assessStart >= 0);
    assert.ok(commitStart > assessStart);

    const assessBody = source.slice(assessStart, commitStart);
    assert.equal(assessBody.includes('revert snapshot'), false);
    assert.equal(assessBody.includes('revertedSnapshotId'), false);
  });
});
