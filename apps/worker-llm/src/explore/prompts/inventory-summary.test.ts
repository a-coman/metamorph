import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { PageSnapshotInventory } from '@metamorph/core';
import {
  buildEnrichedInventorySection,
  buildInventorySummary,
} from './inventory-summary.js';

function sampleInventory(): PageSnapshotInventory {
  return {
    url: 'https://example.com',
    capturedAt: new Date().toISOString(),
    pageMetrics: { width: 1920, height: 1080 },
    viewport: { width: 1920, height: 1080 },
    labeledCount: 0,
    items: [
      {
        index: 0,
        shortId: 'E1',
        locator: null,
        selector: '#search',
        score: 100,
        labelShown: false,
        tagName: 'input',
        role: 'searchbox',
        name: 'q',
        ariaLabel: null,
        textPreview: 'Search',
      },
      {
        index: 1,
        shortId: 'E2',
        locator: null,
        selector: '#sort',
        score: 90,
        labelShown: false,
        tagName: 'select',
        role: null,
        name: null,
        ariaLabel: 'Sort',
        textPreview: null,
        options: [
          { value: 'relevance', label: 'Relevance' },
          { value: 'price-asc', label: 'Price: Low to High' },
        ],
      },
    ],
  };
}

describe('inventory-summary', () => {
  it('includes select options in item line', () => {
    const summary = buildInventorySummary(sampleInventory());

    assert.match(summary, /E2 \| select/);
    assert.match(summary, /options=\[/);
    assert.match(summary, /"relevance"/);
    assert.match(summary, /"price-asc"/);
  });

  it('includes only inventory in enriched section', () => {
    const section = buildEnrichedInventorySection(sampleInventory());

    assert.match(section, /Current inventory/);
    assert.match(section, /E1 \| input/);
    assert.doesNotMatch(section, /Page structure/);
    assert.doesNotMatch(section, /accessibility tree/i);
  });
});
