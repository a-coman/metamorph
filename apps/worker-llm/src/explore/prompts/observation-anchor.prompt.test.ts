import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { PageSnapshotInventory } from '@metamorph/core';
import { buildObservationAnchorUserText } from './observation-anchor.prompt.js';

function inventoryWithCount(count: number): PageSnapshotInventory {
  const observationItems = Array.from({ length: count }, (_, index) => ({
    index,
    shortId: `E${index + 1}`,
    locator: null,
    selector: `#obs-${index}`,
    score: 0,
    labelShown: false,
    tagName: 'span',
    id: null,
    role: null,
    name: null,
    ariaLabel: null,
    textPreview: `obs-${index}`,
    selectorMatchCount: 1,
  }));

  return {
    url: 'https://example.com/s?k=test',
    capturedAt: new Date().toISOString(),
    pageMetrics: { width: 1280, height: 720 },
    viewport: { width: 1280, height: 720 },
    labeledCount: 0,
    observationItems,
    items: [],
  };
}

describe('buildObservationAnchorUserText', () => {
  it('includes the full observation inventory without an 80-item cap', () => {
    const text = buildObservationAnchorUserText({
      url: 'https://example.com/s?k=test',
      mrIntent: {
        mr_definition: {
          precondition: { description: 'pre' },
          transformation: {
            transform_family: 'subset',
            description: 'filter results',
          },
          relation: {
            type: 'cardinality_lte',
            on: ['applied_query', 'reported_total_results'],
            description: 'total does not increase',
          },
        },
        exploration: {
          source_phase_goal: 'reach results',
          follow_up_phase_goal: 'apply filter',
        },
      },
      inventory: inventoryWithCount(95),
    });

    assert.match(text, /E80 \|/);
    assert.match(text, /E95 \|/);
    assert.doesNotMatch(text, /E96 \|/);
    assert.match(text, /raw screenshot without on-image labels/);
    assert.match(text, /Observation inventory/);
  });
});
