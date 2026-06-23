import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { compilePlaybook } from './playbook-compiler.js';
import type { GenerationSlots } from '../../domain/schemas/generation-slots.schema.js';
import type { PageSnapshotInventory } from '../../domain/schemas/page-snapshot.schema.js';

const inventory: PageSnapshotInventory = {
  url: 'https://example.com/s?k=test',
  capturedAt: new Date().toISOString(),
  pageMetrics: { width: 1280, height: 720 },
  viewport: { width: 1280, height: 720 },
  labeledCount: 2,
  items: [
    {
      index: 0,
      shortId: 'E1',
      locator: null,
      selector: '#results',
      score: 1,
      labelShown: true,
      tagName: 'div',
      id: 'results',
      role: null,
      name: null,
      ariaLabel: null,
      selectorMatchCount: 1,
    },
    {
      index: 1,
      shortId: 'E2',
      locator: 'getByRole("searchbox")',
      selector: 'input',
      score: 1,
      labelShown: true,
      tagName: 'input',
      id: null,
      role: 'searchbox',
      name: 'Search',
      ariaLabel: null,
      locatorMatchCount: 1,
    },
  ],
};

const slots: GenerationSlots = {
  source: {
    steps: [{ id: 1, action: 'click', element_id: 'E2' }],
  },
  follow_up: {
    steps: [{ id: 1, action: 'click', element_id: 'E2' }],
  },
  observation: {
    fields: ['applied_query', 'visible_item_count'],
    anchors: {
      visible_item_count: {
        container_element_id: 'E1',
        inventory_snapshot_id: '00000000-0000-4000-8000-000000000001',
        item_selector_hint: 'listitem',
      },
    },
  },
};

describe('compilePlaybook with observation anchors', () => {
  it('embeds anchored visible_item_count extractor', () => {
    const anchorInventories = new Map([
      ['00000000-0000-4000-8000-000000000001', inventory],
    ]);

    const compiled = compilePlaybook(
      slots,
      {
        precondition: { description: 'pre' },
        transformation: {
          transform_family: 'inclusion',
          description: 'filter',
        },
        relation: {
          type: 'cardinality_lte',
          on: ['applied_query', 'visible_item_count'],
          description: 'count',
        },
      },
      inventory,
      { anchorInventories },
    );

    assert.match(compiled.playbookContent, /visible_item_count:/);
    assert.match(compiled.playbookContent, /#results/);
    assert.equal(compiled.templateVersion, 'playbook-template@3');
  });
});
