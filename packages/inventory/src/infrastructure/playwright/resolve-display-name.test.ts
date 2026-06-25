import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { resolveShortDisplayName } from './resolve-display-name.js';

describe('resolveShortDisplayName', () => {
  it('prefers visible text when provided', () => {
    assert.equal(
      resolveShortDisplayName('Aplicar filtro de Sony para reducir los resultados', 'Sony'),
      'Sony',
    );
  });

  it('extracts short name from Spanish filter aria-label patterns', () => {
    assert.equal(
      resolveShortDisplayName('Aplicar filtro de Soundcore para reducir los resultados'),
      'Soundcore',
    );
  });

  it('extracts short name from English filter aria-label patterns', () => {
    assert.equal(resolveShortDisplayName('Apply OPPO filter'), 'OPPO');
  });
});
