import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { TRANSFORM_FAMILIES } from '@metamorph/core';

describe('TRANSFORM_FAMILIES fan-out contract', () => {
  it('defines four explore families', () => {
    assert.deepEqual(TRANSFORM_FAMILIES, [
      'idempotence',
      'inclusion',
      'permutation',
      'inverse',
    ]);
  });
});
