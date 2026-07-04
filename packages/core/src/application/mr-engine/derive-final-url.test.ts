import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { ObservableDef } from '../../domain/schemas/observable.schema.js';
import { deriveFinalUrlFromObservation } from './derive-final-url.js';

const sessionUrl = 'https://www.example.com/home';

describe('deriveFinalUrlFromObservation', () => {
  it('returns legacy results_url when present', () => {
    const url = deriveFinalUrlFromObservation(
      { results_url: 'https://legacy.example/s?q=1' },
      [],
      sessionUrl,
    );
    assert.equal(url, 'https://legacy.example/s?q=1');
  });

  it('derives absolute URL from url_params observable value', () => {
    const observables = [
      {
        key: 'stable_url',
        valueType: 'string',
        compare: 'equal',
        binding: {
          kind: 'url_params',
          inventory_snapshot_id: '00000000-0000-4000-8000-000000000001',
          param_keys: ['k'],
        },
        rationale: 'stable query',
      },
    ] as ObservableDef[];

    const url = deriveFinalUrlFromObservation(
      { stable_url: '/s?k=laptop' },
      observables,
      sessionUrl,
    );
    assert.equal(url, 'https://www.example.com/s?k=laptop');
  });

  it('derives absolute URL from url_pathname observable value', () => {
    const observables = [
      {
        key: 'pathname',
        valueType: 'string',
        compare: 'equal',
        binding: {
          kind: 'url_pathname',
          inventory_snapshot_id: '00000000-0000-4000-8000-000000000001',
        },
        rationale: 'pathname stable',
      },
    ] as ObservableDef[];

    const url = deriveFinalUrlFromObservation(
      { pathname: '/search' },
      observables,
      sessionUrl,
    );
    assert.equal(url, 'https://www.example.com/search');
  });

  it('returns null when no URL signal exists', () => {
    const url = deriveFinalUrlFromObservation({ search_query: 'laptop' }, [], sessionUrl);
    assert.equal(url, null);
  });
});
