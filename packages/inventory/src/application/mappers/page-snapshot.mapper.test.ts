import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { toPageSnapshotPayload } from './page-snapshot.mapper.js';
import type { PageInventory } from '../../domain/types/inventory-item.types.js';

describe('toPageSnapshotPayload', () => {
  it('includes observationItems in persisted JSON payload', () => {
    const inventory: PageInventory = {
      url: 'https://example.com/s?k=test',
      capturedAt: new Date().toISOString(),
      pageMetrics: { width: 1280, height: 720 },
      viewport: { width: 1280, height: 720 },
      labeledCount: 1,
      items: [
        {
          index: 0,
          shortId: 'E1',
          locator: null,
          selector: 'button',
          score: 10,
          labelShown: true,
          tagName: 'button',
          id: null,
          role: 'button',
          name: null,
          ariaLabel: null,
          textPreview: 'Search',
        },
      ],
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
          ariaLabel: null,
          textPreview: '1-48 de más de 10.000 resultados',
        },
      ],
      screenshot: Buffer.from('annotated'),
      rawScreenshot: Buffer.from('raw'),
    };

    const payload = toPageSnapshotPayload(inventory);

    assert.equal(payload.items.length, 1);
    assert.equal(payload.observationItems?.length, 1);
    assert.match(payload.observationItems?.[0]?.textPreview ?? '', /10\.000/);
    assert.equal((payload as { screenshot?: unknown }).screenshot, undefined);
    assert.equal((payload as { rawScreenshot?: unknown }).rawScreenshot, undefined);
  });
});
