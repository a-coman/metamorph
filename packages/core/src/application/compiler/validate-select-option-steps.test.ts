import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  formatSelectOptionValidationErrors,
  validateSelectOptionSteps,
} from './validate-select-option-steps.js';
import type { PageSnapshotInventory } from '../../domain/schemas/page-snapshot.schema.js';

function inventoryWithItems(
  items: PageSnapshotInventory['items'],
): PageSnapshotInventory {
  return {
    url: 'https://example.com',
    capturedAt: new Date().toISOString(),
    pageMetrics: { width: 1920, height: 1080 },
    viewport: { width: 1920, height: 1080 },
    items,
    labeledCount: 0,
  };
}

describe('validateSelectOptionSteps', () => {
  it('accepts selectOption when value matches inventory options', () => {
    const inventory = inventoryWithItems([
      {
        index: 0,
        shortId: 'E1',
        locator: 'getByRole("combobox", { name: "Sort" })',
        selector: '#sort',
        score: 100,
        labelShown: false,
        tagName: 'select',
        id: 'sort',
        role: null,
        name: null,
        ariaLabel: 'Sort',
        textPreview: null,
        options: [
          { value: 'relevance', label: 'Relevance' },
          { value: 'price', label: 'Price' },
        ],
      },
    ]);

    const errors = validateSelectOptionSteps(
      [{ id: 1, action: 'selectOption', element_id: 'E1', value: 'price' }],
      inventory,
    );

    assert.equal(errors.length, 0);
  });

  it('rejects selectOption with invented value', () => {
    const inventory = inventoryWithItems([
      {
        index: 0,
        shortId: 'E1',
        locator: null,
        selector: '#sort',
        score: 100,
        labelShown: false,
        tagName: 'select',
        id: 'sort',
        role: null,
        name: null,
        ariaLabel: null,
        textPreview: null,
        options: [{ value: 'relevance', label: 'Relevance' }],
      },
    ]);

    const errors = validateSelectOptionSteps(
      [{ id: 1, action: 'selectOption', element_id: 'E1', value: 'relevance_ordering' }],
      inventory,
    );

    assert.equal(errors.length, 1);
    assert.match(errors[0]!.message, /not in options/);
  });

  it('rejects selectOption on searchbox without options', () => {
    const inventory = inventoryWithItems([
      {
        index: 0,
        shortId: 'E1',
        locator: 'getByRole("searchbox")',
        selector: '#search',
        score: 100,
        labelShown: false,
        tagName: 'input',
        id: 'search',
        role: 'searchbox',
        name: 'q',
        ariaLabel: null,
        textPreview: null,
      },
    ]);

    const errors = validateSelectOptionSteps(
      [{ id: 1, action: 'selectOption', element_id: 'E1', value: 'x' }],
      inventory,
    );

    assert.equal(errors.length, 1);
    assert.match(errors[0]!.message, /not allowed on E1/);
  });

  it('formats multiple errors', () => {
    const message = formatSelectOptionValidationErrors([
      { stepId: 1, elementId: 'E1', message: 'error one' },
      { stepId: 2, elementId: 'E2', message: 'error two' },
    ]);

    assert.equal(message, 'error one; error two');
  });
});
