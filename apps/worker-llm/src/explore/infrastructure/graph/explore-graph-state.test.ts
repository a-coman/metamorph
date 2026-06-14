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
});
