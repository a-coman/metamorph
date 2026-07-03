import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { TRANSFORM_FAMILIES } from '@metamorph/core';
import { resolveSessionTransformFamilies } from './resolve-session-transform-families.js';

describe('resolveSessionTransformFamilies', () => {
  it('returns all families when session selection is empty', () => {
    assert.deepEqual(resolveSessionTransformFamilies([]), [...TRANSFORM_FAMILIES]);
    assert.deepEqual(resolveSessionTransformFamilies(undefined), [...TRANSFORM_FAMILIES]);
  });

  it('returns only the selected families', () => {
    assert.deepEqual(resolveSessionTransformFamilies(['subset']), ['subset']);
    assert.deepEqual(resolveSessionTransformFamilies(['subset', 'inverse']), [
      'subset',
      'inverse',
    ]);
  });

  it('filters unknown families', () => {
    assert.deepEqual(resolveSessionTransformFamilies(['subset', 'unknown']), [
      'subset',
    ]);
  });
});

describe('TRANSFORM_FAMILIES fan-out contract', () => {
  it('defines four explore families', () => {
    assert.deepEqual(TRANSFORM_FAMILIES, [
      'idempotence',
      'subset',
      'permutation',
      'inverse',
    ]);
  });
});
