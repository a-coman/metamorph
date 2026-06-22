import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { InventoryItem } from '@metamorph/core';
import { annotateAccessibilityTree } from './annotate-accessibility-tree.js';

function item(
  overrides: Partial<InventoryItem> & Pick<InventoryItem, 'shortId' | 'role' | 'name'>,
): InventoryItem {
  return {
    index: 0,
    locator: null,
    selector: '#x',
    score: 1,
    labelShown: true,
    tagName: 'button',
    id: null,
    ariaLabel: null,
    textPreview: null,
    ...overrides,
  };
}

const cookieDialogSnapshot = `- dialog "Usamos cookies"
  - button "Aceptar todas"
- searchbox "¿Adónde?"`;

const cookieItems: InventoryItem[] = [
  item({
    shortId: 'E2',
    tagName: 'button',
    role: 'button',
    name: 'Aceptar todas',
    index: 1,
  }),
  item({
    shortId: 'E1',
    tagName: 'input',
    role: 'searchbox',
    name: '¿Adónde?',
    index: 0,
  }),
];

describe('annotateAccessibilityTree', () => {
  it('annotates matching nodes with inventory shortIds', () => {
    const annotated = annotateAccessibilityTree(cookieDialogSnapshot, cookieItems);

    assert.match(annotated, /button "Aceptar todas" → E2/);
    assert.match(annotated, /searchbox "¿Adónde\?" → E1/);
    assert.doesNotMatch(annotated, /dialog "Usamos cookies" →/);
  });

  it('leaves unmatched tree nodes without annotations', () => {
    const annotated = annotateAccessibilityTree(cookieDialogSnapshot, [
      item({
        shortId: 'E1',
        tagName: 'input',
        role: 'searchbox',
        name: '¿Adónde?',
        index: 0,
      }),
    ]);

    assert.match(annotated, /searchbox "¿Adónde\?" → E1/);
    assert.match(annotated, /- button "Aceptar todas"\n/);
    assert.doesNotMatch(annotated, /→ E2/);
  });

  it('matches listbox options by role and name', () => {
    const snapshot = `- listbox "Sugerencias"
  - option "Madrid"
  - option "Barcelona"`;

    const items: InventoryItem[] = [
      item({
        shortId: 'E3',
        tagName: 'div',
        role: null,
        name: null,
        textPreview: 'Madrid',
        index: 2,
      }),
      item({
        shortId: 'E4',
        tagName: 'div',
        role: null,
        name: null,
        textPreview: 'Barcelona',
        index: 3,
      }),
    ];

    const annotated = annotateAccessibilityTree(snapshot, items);
    assert.match(annotated, /option "Madrid" → E3/);
    assert.match(annotated, /option "Barcelona" → E4/);
  });

  it('returns empty string for empty snapshot', () => {
    assert.equal(annotateAccessibilityTree('', cookieItems), '');
    assert.equal(annotateAccessibilityTree('   ', cookieItems), '');
  });

  it('truncates very large trees', () => {
    const lines = Array.from({ length: 500 }, (_, index) => `- button "Item ${index}"`);
    const snapshot = lines.join('\n');
    const items = [
      item({
        shortId: 'E1',
        role: 'button',
        name: 'Item 0',
        index: 0,
      }),
    ];

    const annotated = annotateAccessibilityTree(snapshot, items, { maxChars: 500 });
    assert.ok(annotated.length <= 600);
    assert.match(annotated, /tree truncated/);
  });
});
