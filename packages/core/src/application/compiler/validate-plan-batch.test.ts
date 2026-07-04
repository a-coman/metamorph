import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { SlotStep } from '../../domain/schemas/generation-slots.schema.js';
import type { PageSnapshotInventory } from '../../domain/schemas/page-snapshot.schema.js';
import { validatePlanBatch } from './validate-plan-batch.js';

const homepageInventory: PageSnapshotInventory = {
  url: 'https://www.amazon.es/',
  capturedAt: new Date().toISOString(),
  pageMetrics: { width: 1280, height: 720 },
  viewport: { width: 1280, height: 720 },
  labeledCount: 2,
  items: [
    {
      index: 0,
      shortId: 'E1',
      locator: 'getByRole("button", { name: "Aceptar", exact: true })',
      selector: 'button',
      score: 1,
      labelShown: true,
      tagName: 'button',
      id: null,
      role: 'button',
      name: 'Aceptar',
      ariaLabel: null,
      locatorMatchCount: 1,
    },
    {
      index: 1,
      shortId: 'E6',
      locator: 'getByRole("searchbox", { name: "Buscar en Amazon.es", exact: true })',
      selector: 'input',
      score: 1,
      labelShown: true,
      tagName: 'input',
      id: null,
      role: 'searchbox',
      name: 'Buscar en Amazon.es',
      ariaLabel: null,
      locatorMatchCount: 1,
    },
  ],
  observationItems: [],
};

describe('validatePlanBatch', () => {
  it('accepts click with known element_id', () => {
    const steps: SlotStep[] = [{ id: 1, action: 'click', element_id: 'E1' }];
    assert.deepEqual(validatePlanBatch(steps, homepageInventory), []);
  });

  it('reports unknown element_id on click', () => {
    const steps: SlotStep[] = [{ id: 1, action: 'click', element_id: 'E99' }];
    assert.deepEqual(validatePlanBatch(steps, homepageInventory), ['E99']);
  });

  it('ignores press even when element_id is absent from inventory', () => {
    const steps: SlotStep[] = [{ id: 1, action: 'press', element_id: 'E99', key: 'Enter' }];
    assert.deepEqual(validatePlanBatch(steps, homepageInventory), []);
  });

  it('ignores goto, scroll, and waitFor', () => {
    const steps: SlotStep[] = [
      { id: 1, action: 'goto', url: 'https://www.amazon.es/' },
      { id: 2, action: 'scroll', scroll_y: 500 },
      { id: 3, action: 'waitFor', timeout_ms: 1000 },
    ];
    assert.deepEqual(validatePlanBatch(steps, homepageInventory), []);
  });

  it('reports unknown element_id on fill and selectOption', () => {
    const steps: SlotStep[] = [
      { id: 1, action: 'fill', element_id: 'E99', value: 'laptop' },
      { id: 2, action: 'selectOption', element_id: 'E98', value: 'HP' },
    ];
    assert.deepEqual(validatePlanBatch(steps, homepageInventory), ['E99', 'E98']);
  });

  it('ignores steps that already have resolved_locator', () => {
    const steps: SlotStep[] = [
      {
        id: 1,
        action: 'click',
        element_id: 'E97',
        resolved_locator: 'getByRole("link", { name: "HP filter", exact: true })',
      },
    ];
    assert.deepEqual(validatePlanBatch(steps, homepageInventory), []);
  });

  it('validates only the new follow_up homepage batch without results-page ids', () => {
    const steps: SlotStep[] = [
      { id: 1, action: 'click', element_id: 'E1' },
      { id: 2, action: 'fill', element_id: 'E6', value: 'laptop' },
      { id: 3, action: 'press', element_id: 'E6', key: 'Enter' },
    ];
    assert.deepEqual(validatePlanBatch(steps, homepageInventory), []);
  });

  it('deduplicates repeated missing element_ids', () => {
    const steps: SlotStep[] = [
      { id: 1, action: 'click', element_id: 'E99' },
      { id: 2, action: 'fill', element_id: 'E99', value: 'laptop' },
    ];
    assert.deepEqual(validatePlanBatch(steps, homepageInventory), ['E99']);
  });
});
