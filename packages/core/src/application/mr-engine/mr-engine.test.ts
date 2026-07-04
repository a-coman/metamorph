import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  applyFamilyProfile,
  getFamilyProfile,
  isCompareAllowedForFamily,
  isTransformFamily,
  TRANSFORM_FAMILIES,
} from '../../domain/mr-family-profile.js';
import type { ObservableDef } from '../../domain/schemas/observable.schema.js';
import { evaluateMr } from './mr-engine.js';
import {
  evaluateCardinalityLte,
  evaluateEqual,
  evaluateSetEqual,
} from './relation-evaluators.js';

describe('mr-family-profile', () => {
  it('exposes four transform families', () => {
    assert.equal(TRANSFORM_FAMILIES.length, 4);
    assert.ok(isTransformFamily('subset'));
    assert.equal(isTransformFamily('unknown'), false);
  });

  it('applyFamilyProfile locks transform family without overwriting relation.on', () => {
    const profile = getFamilyProfile('subset');
    assert.deepEqual(profile.allowedCompares, ['equal', 'cardinality_lte']);
    assert.ok(isCompareAllowedForFamily('subset', 'cardinality_lte'));
    assert.equal(isCompareAllowedForFamily('subset', 'set_equal'), false);

    const applied = applyFamilyProfile(
      {
        precondition: { description: 'pre' },
        transformation: {
          transform_family: 'idempotence',
          description: 'wrong',
        },
        relation: {
          on: ['custom_key'],
          description: 'rel',
        },
      },
      'subset',
    );

    assert.equal(applied.transformation.transform_family, 'subset');
    assert.deepEqual(applied.relation.on, ['custom_key']);
  });
});

describe('relation-evaluators', () => {
  it('evaluateEqual trims strings', () => {
    assert.equal(evaluateEqual(' foo ', 'foo'), true);
    assert.equal(evaluateEqual('a', 'b'), false);
  });

  it('evaluateEqual compares numbers and booleans', () => {
    assert.equal(evaluateEqual(42, 42), true);
    assert.equal(evaluateEqual(42, 43), false);
    assert.equal(evaluateEqual(true, true), true);
    assert.equal(evaluateEqual(true, false), false);
  });

  it('evaluateEqual compares arrays in order', () => {
    assert.equal(evaluateEqual([], []), true);
    assert.equal(evaluateEqual(['a', 'b'], ['a', 'b']), true);
    assert.equal(evaluateEqual(['a', 'b'], ['b', 'a']), false);
    assert.equal(evaluateEqual([' foo '], ['foo']), true);
    assert.equal(evaluateEqual(['a'], ['a', 'b']), false);
  });

  it('evaluateSetEqual ignores order', () => {
    assert.equal(evaluateSetEqual(['a', 'b'], ['b', 'a']), true);
    assert.equal(evaluateSetEqual(['a'], ['a', 'b']), false);
  });

  it('evaluateCardinalityLte requires finite numbers', () => {
    assert.equal(evaluateCardinalityLte(10, 8), true);
    assert.equal(evaluateCardinalityLte(10, 12), false);
    assert.equal(evaluateCardinalityLte(null, 1), false);
    assert.equal(evaluateCardinalityLte(1, Number.NaN), false);
  });
});

describe('evaluateMr', () => {
  const observables: ObservableDef[] = [
    {
      key: 'search_query',
      valueType: 'string',
      compare: 'equal',
      binding: {
        kind: 'input_value',
        inventory_snapshot_id: '00000000-0000-4000-8000-000000000001',
        element_id: 'E1',
      },
      rationale: 'query stable',
    },
    {
      key: 'result_count',
      valueType: 'number',
      compare: 'cardinality_lte',
      binding: {
        kind: 'number_from_label',
        inventory_snapshot_id: '00000000-0000-4000-8000-000000000001',
        element_id: 'E2',
        number_index: 0,
      },
      rationale: 'count does not increase',
    },
  ];

  it('passes cardinality_lte when follow_up count is lower', () => {
    const result = evaluateMr(
      observables,
      { search_query: 'hotel', result_count: 30000 },
      { search_query: 'hotel', result_count: 5000 },
    );
    assert.equal(result.verdict, 'pass');
  });

  it('fails when observation is missing', () => {
    const result = evaluateMr(
      observables,
      { search_query: 'hotel', result_count: 30000 },
      { search_query: 'hotel', result_count: null },
    );
    assert.equal(result.verdict, 'fail');
    assert.equal(result.details.result_count?.error, 'Missing observation value');
  });

  it('passes equal compare for matching string arrays', () => {
    const listObservable: ObservableDef = {
      key: 'titles',
      valueType: 'string[]',
      compare: 'equal',
      binding: {
        kind: 'list_texts',
        inventory_snapshot_id: '00000000-0000-4000-8000-000000000001',
        element_ids: ['E1'],
      },
      rationale: 'listing fingerprint',
    };

    const result = evaluateMr(
      [listObservable],
      { titles: ['Alpha', 'Beta'] },
      { titles: ['Alpha', 'Beta'] },
    );

    assert.equal(result.verdict, 'pass');
    assert.equal(result.details.titles?.ok, true);
  });
});
