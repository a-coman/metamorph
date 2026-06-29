import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  findObservationItem,
  observationLabelText,
  requireObservationItems,
} from './observation-inventory.js';
import type { PageSnapshotInventory } from './schemas/page-snapshot.schema.js';

const baseInventory: PageSnapshotInventory = {
  url: 'https://example.com',
  capturedAt: new Date().toISOString(),
  pageMetrics: { width: 800, height: 600 },
  viewport: { width: 800, height: 600 },
  labeledCount: 0,
  items: [],
  observationItems: [
    {
      index: 0,
      shortId: 'E1',
      locator: null,
      selector: '.count',
      score: 0,
      labelShown: false,
      tagName: 'div',
      id: null,
      role: null,
      name: null,
      ariaLabel: 'Results',
      textPreview: '1-48 de más de 10.000 resultados',
    },
  ],
};

describe('observation-inventory helpers', () => {
  it('requireObservationItems returns observation items', () => {
    assert.equal(requireObservationItems(baseInventory).length, 1);
  });

  it('requireObservationItems throws when missing', () => {
    assert.throws(
      () => requireObservationItems({ ...baseInventory, observationItems: undefined }),
      /no observationItems/,
    );
  });

  it('findObservationItem resolves by shortId', () => {
    assert.equal(findObservationItem(baseInventory, 'E1')?.tagName, 'div');
    assert.equal(findObservationItem(baseInventory, 'E99'), undefined);
  });

  it('observationLabelText merges textPreview and ariaLabel', () => {
    const item = findObservationItem(baseInventory, 'E1')!;
    assert.match(observationLabelText(item), /10\.000/);
    assert.match(observationLabelText(item), /Results/);
  });
});
