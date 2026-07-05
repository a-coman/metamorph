import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { ObservableDef } from './schemas/observable.schema.js';
import { validateObservableBindingValueType } from './observable-spec-validation.js';

const snapshotId = '00000000-0000-4000-8000-000000000001';

function observable(overrides: Partial<ObservableDef> & Pick<ObservableDef, 'binding'>): ObservableDef {
  return {
    key: 'test_key',
    valueType: 'string',
    compare: 'equal',
    rationale: 'test',
    ...overrides,
  };
}

describe('validateObservableBindingValueType', () => {
  it('passes number_from_label with number and cardinality_lte', () => {
    const result = validateObservableBindingValueType(
      observable({
        key: 'result_count',
        valueType: 'number',
        compare: 'cardinality_lte',
        binding: {
          kind: 'number_from_label',
          inventory_snapshot_id: snapshotId,
          element_id: 'E1',
          number_index: 0,
        },
      }),
    );

    assert.equal(result, null);
  });

  it('fails list_texts with number (Airbnb bug class)', () => {
    const result = validateObservableBindingValueType(
      observable({
        key: 'amenity_filter_count',
        valueType: 'number',
        compare: 'cardinality_lte',
        binding: {
          kind: 'list_texts',
          inventory_snapshot_id: snapshotId,
          element_ids: ['E12', 'E13'],
        },
      }),
    );

    assert.match(result ?? '', /list_texts requires valueType string\[\]/);
  });

  it('fails text_content with number', () => {
    const result = validateObservableBindingValueType(
      observable({
        key: 'label',
        valueType: 'number',
        binding: {
          kind: 'text_content',
          inventory_snapshot_id: snapshotId,
          element_id: 'E1',
        },
      }),
    );

    assert.match(result ?? '', /text_content requires valueType string/);
  });

  it('fails cardinality_lte with string valueType', () => {
    const result = validateObservableBindingValueType(
      observable({
        key: 'query',
        valueType: 'string',
        compare: 'cardinality_lte',
        binding: {
          kind: 'text_content',
          inventory_snapshot_id: snapshotId,
          element_id: 'E1',
        },
      }),
    );

    assert.match(result ?? '', /cardinality_lte requires valueType number/);
  });
});
