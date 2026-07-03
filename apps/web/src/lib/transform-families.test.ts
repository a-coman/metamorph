import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  ALL_TRANSFORM_FAMILIES,
  FAMILY_ORDER,
  formatFamilyLabel,
} from '@/lib/mr-versions';
import { TRANSFORM_FAMILY_DESCRIPTIONS } from '@/lib/transform-families';

describe('transform family catalog', () => {
  it('exposes all four families in stable order', () => {
    assert.deepEqual(ALL_TRANSFORM_FAMILIES, [...FAMILY_ORDER]);
    assert.equal(ALL_TRANSFORM_FAMILIES.length, 4);
  });

  it('formats labels for display', () => {
    assert.equal(formatFamilyLabel('idempotence'), 'idempotence');
  });

  it('provides a short description for each family', () => {
    for (const family of ALL_TRANSFORM_FAMILIES) {
      assert.ok(TRANSFORM_FAMILY_DESCRIPTIONS[family].length > 0);
    }
  });
});

describe('session create category selection', () => {
  it('requires at least one selected family before submit', () => {
    const canSubmit = (families: string[]) => families.length > 0;
    assert.equal(canSubmit([]), false);
    assert.equal(canSubmit(['subset']), true);
    assert.equal(canSubmit([...ALL_TRANSFORM_FAMILIES]), true);
  });
});
