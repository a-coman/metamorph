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

  it('observation_anchor falls back to currentSnapshotId before switch_phase', () => {
    const source = readFileSync(graphSourcePath, 'utf8');
    const anchorStart = source.indexOf('async function observationAnchorNode');
    const switchPhaseStart = source.indexOf('async function switchPhaseNode');
    assert.ok(anchorStart >= 0);
    assert.ok(switchPhaseStart > anchorStart);

    const anchorBody = source.slice(anchorStart, switchPhaseStart);
    assert.match(
      anchorBody,
      /sourceEndSnapshotId\s*\?\?\s*state\.currentSnapshotId/,
      'observation_anchor must use currentSnapshotId when sourceEndSnapshotId is unset',
    );
  });

  it('observation_anchor validates number_index in anchor node', () => {
    const source = readFileSync(graphSourcePath, 'utf8');
    const anchorStart = source.indexOf('async function observationAnchorNode');
    const switchPhaseStart = source.indexOf('async function switchPhaseNode');
    assert.ok(anchorStart >= 0);
    assert.ok(switchPhaseStart > anchorStart);

    const anchorBody = source.slice(anchorStart, switchPhaseStart);
    assert.match(anchorBody, /parseLocalizedNumbers/);
    assert.match(anchorBody, /reported_total_results/);
    assert.match(anchorBody, /number_index/);
    assert.match(anchorBody, /MIN_RESULT_LABEL_ELEMENT_AREA_PX/);
    assert.match(anchorBody, /loadRawBase64/);
    assert.match(anchorBody, /requireObservationItems/);
    assert.match(anchorBody, /findObservationItem/);
    assert.match(anchorBody, /observationLabelText/);
  });
});
