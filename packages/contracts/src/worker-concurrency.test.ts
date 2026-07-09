import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  DEFAULT_WORKER_CONCURRENCY,
  resolveLlmConcurrency,
  resolvePlaywrightConcurrency,
  resolveWorkerConcurrency,
} from './worker-concurrency.js';

describe('resolveWorkerConcurrency', () => {
  it('defaults to four', () => {
    assert.equal(resolveWorkerConcurrency(undefined), DEFAULT_WORKER_CONCURRENCY);
    assert.equal(resolveWorkerConcurrency(''), DEFAULT_WORKER_CONCURRENCY);
  });

  it('parses valid values and caps at sixteen', () => {
    assert.equal(resolveWorkerConcurrency('1'), 1);
    assert.equal(resolveWorkerConcurrency('4'), 4);
    assert.equal(resolveWorkerConcurrency('99'), 16);
  });

  it('falls back on invalid values', () => {
    assert.equal(resolveWorkerConcurrency('0'), DEFAULT_WORKER_CONCURRENCY);
    assert.equal(resolveWorkerConcurrency('nope'), DEFAULT_WORKER_CONCURRENCY);
  });
});

describe('resolvePlaywrightConcurrency', () => {
  it('reads MAX_CONCURRENT_BROWSERS', () => {
    assert.equal(
      resolvePlaywrightConcurrency({ MAX_CONCURRENT_BROWSERS: '3' }),
      3,
    );
  });
});

describe('resolveLlmConcurrency', () => {
  it('prefers WORKER_LLM_CONCURRENCY over MAX_CONCURRENT_BROWSERS', () => {
    assert.equal(
      resolveLlmConcurrency({
        WORKER_LLM_CONCURRENCY: '2',
        MAX_CONCURRENT_BROWSERS: '4',
      }),
      2,
    );
  });

  it('falls back to MAX_CONCURRENT_BROWSERS', () => {
    assert.equal(
      resolveLlmConcurrency({ MAX_CONCURRENT_BROWSERS: '4' }),
      4,
    );
  });
});
