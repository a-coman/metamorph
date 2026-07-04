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
  observationItems: [
    {
      index: 0,
      shortId: 'E1',
      locator: null,
      selector: '.s-breadcrumb-header-text',
      score: 0,
      labelShown: false,
      tagName: 'div',
      id: null,
      role: null,
      name: null,
      ariaLabel: null,
      textPreview: '1-48 de más de 30.000 resultados',
      selectorMatchCount: 1,
    },
    {
      index: 1,
      shortId: 'E2',
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

const slots: GenerationSlots = {
  source: {
    steps: [{ id: 1, action: 'click', element_id: 'E1' }],
  },
  follow_up: {
    steps: [{ id: 1, action: 'click', element_id: 'E1' }],
  },
  observation: {
    fields: ['applied_query', 'reported_total_results'],
    anchors: {
      reported_total_results: {
        label_element_id: 'E1',
        inventory_snapshot_id: '00000000-0000-4000-8000-000000000001',
        number_index: 2,
      },
    },
  },
};

describe('compilePlaybook with observation anchors', () => {
  it('embeds anchored reported_total_results extractor', () => {
    const anchorInventories = new Map([
      ['00000000-0000-4000-8000-000000000001', inventory],
    ]);

    const compiled = compilePlaybook(
      slots,
      {
        precondition: { description: 'pre' },
        transformation: {
          transform_family: 'subset',
          description: 'filter',
        },
        relation: {
          type: 'cardinality_lte',
          on: ['applied_query', 'reported_total_results'],
          description: 'count',
        },
      },
      inventory,
      { anchorInventories },
    );

    assert.match(compiled.playbookContent, /reported_total_results:/);
    assert.match(compiled.playbookContent, /\.s-breadcrumb-header-text/);
    assert.match(compiled.playbookContent, /textContent/);
    assert.match(compiled.playbookContent, /parseLocalizedNumbers/);
    assert.equal(compiled.templateVersion, 'playbook-template@4');
  });

  it('allows press steps whose element_id belongs to a later snapshot inventory', () => {
    const crossSnapshotSlots: GenerationSlots = {
      source: {
        steps: [
          {
            id: 1,
            action: 'fill',
            element_id: 'E1',
            value: 'laptop',
            resolved_locator: 'getByRole("searchbox", { name: "Search", exact: true })',
          },
          { id: 2, action: 'press', element_id: 'E1', key: 'Enter' },
        ],
      },
      follow_up: {
        steps: [
          {
            id: 1,
            action: 'fill',
            element_id: 'E94',
            value: 'laptop',
            resolved_locator: 'getByRole("searchbox", { name: "Search", exact: true })',
          },
          { id: 2, action: 'press', element_id: 'E94', key: 'Enter' },
        ],
      },
      observation: { fields: [] },
    };

    const compiled = compilePlaybook(
      crossSnapshotSlots,
      {
        precondition: { description: 'pre' },
        transformation: {
          transform_family: 'idempotence',
          description: 'repeat search',
        },
        relation: {
          type: 'equal',
          on: ['url'],
          description: 'same results',
        },
      },
      inventory,
    );

    assert.match(compiled.playbookContent, /keyboard\.press\("Enter"\)/);
  });
});
