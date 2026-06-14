import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  ELEMENT_SHORT_ID_PATTERN,
  formatElementShortId,
  normalizeElementShortId,
} from './element-short-id.js';

describe('element short id', () => {
  it('formats labels without zero-padding', () => {
    assert.equal(formatElementShortId(0), 'E1');
    assert.equal(formatElementShortId(3), 'E4');
    assert.equal(formatElementShortId(41), 'E42');
  });

  it('accepts canonical ids in the schema pattern', () => {
    assert.match('E1', ELEMENT_SHORT_ID_PATTERN);
    assert.match('E4', ELEMENT_SHORT_ID_PATTERN);
    assert.match('E42', ELEMENT_SHORT_ID_PATTERN);
    assert.doesNotMatch('E04', ELEMENT_SHORT_ID_PATTERN);
    assert.doesNotMatch('E', ELEMENT_SHORT_ID_PATTERN);
  });

  it('normalizes zero-padded LLM output', () => {
    assert.equal(normalizeElementShortId('E04'), 'E4');
    assert.equal(normalizeElementShortId('E004'), 'E4');
    assert.equal(normalizeElementShortId('E42'), 'E42');
  });
});
