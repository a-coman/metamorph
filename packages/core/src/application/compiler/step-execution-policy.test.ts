import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { InventoryItem } from '../../domain/schemas/page-snapshot.schema.js';
import {
  isComboboxInventoryItem,
  isFillableInventoryItem,
} from './step-execution-policy.js';

function item(overrides: Partial<InventoryItem> & Pick<InventoryItem, 'tagName'>): InventoryItem {
  return {
    index: 0,
    shortId: 'E1',
    locator: null,
    selector: '#x',
    score: 100,
    labelShown: false,
    id: null,
    role: null,
    name: null,
    ariaLabel: null,
    textPreview: null,
    ...overrides,
  };
}

describe('isFillableInventoryItem', () => {
  it('treats input and textarea as fillable', () => {
    assert.equal(isFillableInventoryItem(item({ tagName: 'input', role: 'textbox' })), true);
    assert.equal(isFillableInventoryItem(item({ tagName: 'textarea', role: 'textbox' })), true);
  });

  it('excludes native select even when role is combobox', () => {
    assert.equal(
      isFillableInventoryItem(item({ tagName: 'select', role: 'combobox' })),
      false,
    );
  });

  it('treats custom combobox roles as fillable', () => {
    assert.equal(
      isFillableInventoryItem(item({ tagName: 'div', role: 'combobox' })),
      true,
    );
  });
});

describe('isComboboxInventoryItem', () => {
  it('excludes native select', () => {
    assert.equal(isComboboxInventoryItem(item({ tagName: 'select', role: 'combobox' })), false);
  });

  it('includes custom combobox and searchbox', () => {
    assert.equal(isComboboxInventoryItem(item({ tagName: 'div', role: 'combobox' })), true);
    assert.equal(isComboboxInventoryItem(item({ tagName: 'input', role: 'searchbox' })), true);
  });
});
