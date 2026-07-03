import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { TRANSFORM_FAMILIES } from '@metamorph/core';
import { SessionAggregate } from './session.aggregate.js';

describe('SessionAggregate.create', () => {
  it('defaults transformFamilies to all four families', () => {
    const result = SessionAggregate.create({ url: 'https://example.com' });
    assert.equal(result.isRight(), true);
    if (result.isRight()) {
      assert.deepEqual(result.value.transformFamilies, [...TRANSFORM_FAMILIES]);
    }
  });

  it('stores the selected transformFamilies', () => {
    const result = SessionAggregate.create({
      url: 'https://example.com',
      transformFamilies: ['subset', 'inverse'],
    });
    assert.equal(result.isRight(), true);
    if (result.isRight()) {
      assert.deepEqual(result.value.transformFamilies, ['subset', 'inverse']);
    }
  });

  it('deduplicates transformFamilies', () => {
    const result = SessionAggregate.create({
      url: 'https://example.com',
      transformFamilies: ['subset', 'subset'],
    });
    assert.equal(result.isRight(), true);
    if (result.isRight()) {
      assert.deepEqual(result.value.transformFamilies, ['subset']);
    }
  });
});
