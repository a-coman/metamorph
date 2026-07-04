import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  renderObservableExtractor,
  validateObservableBindings,
} from './observation-binding-compiler.js';
import type { ObservableDef } from '../../domain/schemas/observable.schema.js';
import type { PageSnapshotInventory } from '../../domain/schemas/page-snapshot.schema.js';

const snapshotId = '00000000-0000-4000-8000-000000000001';

const inventory: PageSnapshotInventory = {
  url: 'https://example.com/s?k=test',
  capturedAt: new Date().toISOString(),
  pageMetrics: { width: 1280, height: 720 },
  viewport: { width: 1280, height: 720 },
  labeledCount: 1,
  items: [],
  observationItems: [
    {
      index: 0,
      shortId: 'E1',
      locator: 'getByRole("searchbox")',
      selector: 'input',
      score: 0,
      labelShown: false,
      tagName: 'input',
      id: null,
      role: 'searchbox',
      name: 'Search',
      ariaLabel: null,
      locatorMatchCount: 1,
    },
  ],
};

describe('observation-binding-compiler', () => {
  const observables: ObservableDef[] = [
    {
      key: 'search_query',
      valueType: 'string',
      compare: 'equal',
      binding: {
        kind: 'input_value',
        inventory_snapshot_id: snapshotId,
        element_id: 'E1',
      },
      rationale: 'stable query',
    },
    {
      key: 'pathname',
      valueType: 'string',
      compare: 'equal',
      binding: {
        kind: 'url_pathname',
        inventory_snapshot_id: snapshotId,
      },
      rationale: 'stable path',
    },
  ];

  it('validates bindings against anchor inventory', () => {
    const anchorInventories = new Map([[snapshotId, inventory]]);
    assert.doesNotThrow(() => validateObservableBindings(observables, anchorInventories));
  });

  it('rejects unknown element ids', () => {
    const anchorInventories = new Map([[snapshotId, inventory]]);
    assert.throws(() =>
      validateObservableBindings(
        [
          {
            ...observables[0]!,
            binding: {
              kind: 'input_value',
              inventory_snapshot_id: snapshotId,
              element_id: 'E99',
            },
          },
        ],
        anchorInventories,
      ),
    );
  });

  it('renders url_pathname extractor fragment', () => {
    const fragment = renderObservableExtractor(observables[1]!, new Map([[snapshotId, inventory]]));
    assert.match(fragment, /pathname:/);
    assert.match(fragment, /new URL\(page\.url\(\)\)\.pathname/);
  });
});
