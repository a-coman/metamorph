import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { computeTokenCostUsd, formatUsd, sumLlmUsage } from './llm-pricing.js';

describe('llm-pricing', () => {
  it('computes token cost from per-million rates', () => {
    const cost = computeTokenCostUsd(1_000_000, 1_000_000);
    assert.equal(cost, 0.3 + 1.2);
  });

  it('sums llm usage and cost', () => {
    const usage = sumLlmUsage([
      { tokensIn: 1000, tokensOut: 500, latencyMs: 1200 },
      { tokensIn: 2000, tokensOut: 1000, latencyMs: 800 },
    ]);
    assert.equal(usage.callCount, 2);
    assert.equal(usage.tokensIn, 3000);
    assert.equal(usage.tokensOut, 1500);
    assert.equal(usage.latencyMs, 2000);
    assert.ok(usage.costUsd > 0);
  });

  it('formats USD', () => {
    assert.equal(formatUsd(1.234), '$1.23');
    assert.equal(formatUsd(0.001), '$0.0010');
  });
});
