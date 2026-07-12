import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { ObservationSpec } from './schemas/observable.schema.js';
import {
  canonicalJson,
  computeReplayBundleHash,
} from './replay-bundle-hash.js';

const observationSpec: ObservationSpec = {
  schemaVersion: 2,
  observables: [
    {
      key: 'path',
      valueType: 'string',
      compare: 'equal',
      binding: {
        kind: 'url_pathname',
        inventory_snapshot_id: '00000000-0000-4000-8000-000000000000',
      },
      rationale: 'The path must remain stable',
    },
  ],
};

describe('replay bundle hash', () => {
  it('is stable across object insertion order', () => {
    assert.equal(canonicalJson({ b: 2, a: 1 }), canonicalJson({ a: 1, b: 2 }));
  });

  it('changes when playbook, observation contract, or template changes', () => {
    const baseline = computeReplayBundleHash({
      playbookContent: 'test("source", () => undefined);',
      observationSpec,
      templateVersion: 'playbook-template@5',
    });

    const changedPlaybook = computeReplayBundleHash({
      playbookContent: 'test("source", () => true);',
      observationSpec,
      templateVersion: 'playbook-template@5',
    });
    const changedObservation = computeReplayBundleHash({
      playbookContent: 'test("source", () => undefined);',
      observationSpec: {
        ...observationSpec,
        observables: [
          { ...observationSpec.observables[0]!, compare: 'not_equal' },
        ],
      },
      templateVersion: 'playbook-template@5',
    });
    const changedTemplate = computeReplayBundleHash({
      playbookContent: 'test("source", () => undefined);',
      observationSpec,
      templateVersion: 'playbook-template@6',
    });

    assert.notEqual(baseline.contentHash, changedPlaybook.contentHash);
    assert.notEqual(
      baseline.replayBundleHash,
      changedPlaybook.replayBundleHash,
    );
    assert.equal(baseline.contentHash, changedObservation.contentHash);
    assert.equal(baseline.contentHash, changedTemplate.contentHash);
    assert.notEqual(
      baseline.replayBundleHash,
      changedObservation.replayBundleHash,
    );
    assert.notEqual(
      baseline.replayBundleHash,
      changedTemplate.replayBundleHash,
    );
  });
});
