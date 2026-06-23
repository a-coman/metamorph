import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  applyFamilyProfile,
  getFamilyProfile,
  isTransformFamily,
  TRANSFORM_FAMILIES,
} from '../../domain/mr-family-profile.js';
import { evaluateMr } from './mr-engine.js';
import {
  evaluateCardinalityLte,
  evaluateEqual,
} from './relation-evaluators.js';

describe('mr-family-profile', () => {
  it('exposes four transform families', () => {
    assert.equal(TRANSFORM_FAMILIES.length, 4);
    assert.ok(isTransformFamily('inclusion'));
    assert.equal(isTransformFamily('unknown'), false);
  });

  it('applyFamilyProfile forces relation fields per family', () => {
    const profile = getFamilyProfile('inclusion');
    assert.equal(profile.relationType, 'cardinality_lte');
    assert.deepEqual(profile.observationFields, [
      'applied_query',
      'visible_item_count',
    ]);

    const applied = applyFamilyProfile(
      {
        precondition: { description: 'pre' },
        transformation: {
          transform_family: 'idempotence',
          description: 'wrong',
        },
        relation: {
          type: 'equal',
          on: ['results_url'],
          description: 'rel',
        },
      },
      'inclusion',
    );

    assert.equal(applied.transformation.transform_family, 'inclusion');
    assert.equal(applied.relation.type, 'cardinality_lte');
    assert.deepEqual(applied.relation.on, ['applied_query', 'visible_item_count']);
  });
});

describe('relation-evaluators', () => {
  it('evaluateEqual trims strings', () => {
    assert.equal(evaluateEqual(' foo ', 'foo'), true);
    assert.equal(evaluateEqual('a', 'b'), false);
  });

  it('evaluateCardinalityLte requires finite numbers', () => {
    assert.equal(evaluateCardinalityLte(10, 8), true);
    assert.equal(evaluateCardinalityLte(10, 12), false);
    assert.equal(evaluateCardinalityLte(null, 1), false);
    assert.equal(evaluateCardinalityLte(1, Number.NaN), false);
  });
});

describe('evaluateMr', () => {
  const baseMr = {
    precondition: { description: 'pre' },
    transformation: {
      transform_family: 'inclusion' as const,
      description: 'add filter',
    },
    relation: {
      type: 'cardinality_lte' as const,
      on: ['applied_query', 'visible_item_count'],
      description: 'count does not increase',
    },
  };

  it('passes cardinality_lte when follow_up count is lower', () => {
    const result = evaluateMr(
      baseMr,
      { applied_query: 'hotel', visible_item_count: 20 },
      { applied_query: 'hotel', visible_item_count: 12 },
    );
    assert.equal(result.verdict, 'pass');
  });

  it('fails when observation is missing', () => {
    const result = evaluateMr(
      baseMr,
      { applied_query: 'hotel', visible_item_count: 20 },
      { applied_query: 'hotel', visible_item_count: null },
    );
    assert.equal(result.verdict, 'fail');
    assert.equal(result.details.visible_item_count?.error, 'Missing observation value');
  });
});
