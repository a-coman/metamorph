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
    assert.deepEqual(summary, {
      count: 4,
      median: 25,
      q1: 17.5,
      q3: 32.5,
      min: 10,
      max: 40,
      range: 30,
      iqr: 15,
      lowerFence: -5,
      upperFence: 55,
      lowerWhisker: 10,
      upperWhisker: 40,
      outliers: [],
    });
  });

  it('computes Tukey whiskers and retains observed outliers', () => {
    const summary = summarizeNumeric([1, 2, 2, 3, 4, 20]);
    assert.equal(summary.lowerFence, -0.625);
    assert.equal(summary.upperFence, 6.375);
    assert.equal(summary.lowerWhisker, 1);
    assert.equal(summary.upperWhisker, 4);
    assert.deepEqual(summary.outliers, [20]);
  });

  it('summarizes empty arrays', () => {
    const summary = summarizeNumeric([]);
    assert.equal(summary.count, 0);
    assert.equal(summary.lowerWhisker, null);
    assert.equal(summary.upperWhisker, null);
    assert.deepEqual(summary.outliers, []);
  });
});
