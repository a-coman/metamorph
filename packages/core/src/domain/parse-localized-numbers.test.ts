import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  parseLocalizedNumbers,
  parseLocalizedNumberToken,
  pickNumberAtIndex,
} from './parse-localized-numbers.js';

describe('parseLocalizedNumberToken', () => {
  it('parses European thousands', () => {
    assert.equal(parseLocalizedNumberToken('30.000'), 30000);
  });

  it('parses US thousands', () => {
    assert.equal(parseLocalizedNumberToken('1,234'), 1234);
  });

  it('parses plain integers', () => {
    assert.equal(parseLocalizedNumberToken('48'), 48);
  });
});

describe('parseLocalizedNumbers', () => {
  it('parses Amazon ES result label', () => {
    assert.deepEqual(
      parseLocalizedNumbers('1-48 de más de 30.000 resultados para "electronics"'),
      [1, 48, 30000],
    );
  });

  it('parses English About N results', () => {
    assert.deepEqual(parseLocalizedNumbers('About 1,234 results'), [1234]);
  });

  it('returns empty array when no numbers', () => {
    assert.deepEqual(parseLocalizedNumbers('no results here'), []);
  });
});

describe('pickNumberAtIndex', () => {
  it('picks total from Amazon label at index 2', () => {
    const text = '1-48 de más de 30.000 resultados';
    assert.equal(pickNumberAtIndex(text, 2), 30000);
  });

  it('returns null when index out of range', () => {
    assert.equal(pickNumberAtIndex('48 results', 1), null);
  });

  it('returns null for negative index', () => {
    assert.equal(pickNumberAtIndex('48 results', -1), null);
  });
});
