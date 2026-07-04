import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  ObservableDefSchema,
  ObservationSpecSchema,
  OBSERVATION_SPEC_SCHEMA_VERSION,
} from './observable.schema.js';
import { ObserveSpecOutputSchema } from './observe-spec-output.schema.js';

const snapshotId = '00000000-0000-4000-8000-000000000001';

describe('observable schemas', () => {
  it('accepts a valid observable def', () => {
    const parsed = ObservableDefSchema.safeParse({
      key: 'search_query',
      valueType: 'string',
      compare: 'equal',
      binding: {
        kind: 'url_pathname',
        inventory_snapshot_id: snapshotId,
      },
      rationale: 'stable path',
    });
    assert.equal(parsed.success, true);
  });

  it('rejects invalid observable keys', () => {
    const parsed = ObservableDefSchema.safeParse({
      key: 'SearchQuery',
      valueType: 'string',
      compare: 'equal',
      binding: {
        kind: 'url_pathname',
        inventory_snapshot_id: snapshotId,
      },
      rationale: 'bad key',
    });
    assert.equal(parsed.success, false);
  });

  it('allows empty draft observation spec', () => {
    const parsed = ObservationSpecSchema.safeParse({
      schemaVersion: OBSERVATION_SPEC_SCHEMA_VERSION,
      observables: [],
    });
    assert.equal(parsed.success, true);
  });

  it('observe spec output requires at least one observable', () => {
    const empty = ObserveSpecOutputSchema.safeParse({ observables: [] });
    const filled = ObserveSpecOutputSchema.safeParse({
      observables: [
        {
          key: 'pathname',
          valueType: 'string',
          compare: 'equal',
          binding: {
            kind: 'url_pathname',
            inventory_snapshot_id: snapshotId,
          },
          rationale: 'path',
        },
      ],
    });
    assert.equal(empty.success, false);
    assert.equal(filled.success, true);
  });
});
