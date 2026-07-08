import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { iqr, median, rate, summarizeNumeric } from './stats.js';

describe('stats', () => {
  it('computes rate with zero denominator as null', () => {
    assert.equal(rate(1, 0), null);
    assert.equal(rate(3, 4), 0.75);
  });

  it('computes median for odd and even lengths', () => {
    assert.equal(median([3, 1, 2]), 2);
    assert.equal(median([4, 1, 3, 2]), 2.5);
    assert.equal(median([]), null);
  });

  it('computes iqr', () => {
    const spread = iqr([1, 2, 3, 4, 5, 6, 7, 8, 9]);
    assert.ok(spread.q1 !== null);
    assert.ok(spread.q3 !== null);
    assert.ok(spread.q1! < spread.q3!);
  });

  it('summarizes numeric arrays', () => {
    const summary = summarizeNumeric([10, 20, 30, 40]);
    assert.equal(summary.count, 4);
    assert.equal(summary.median, 25);
    assert.equal(summary.min, 10);
    assert.equal(summary.max, 40);
  });
});
