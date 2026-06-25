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
  it('omits inventory-matched nodes from the context tree', () => {
    const contextTree = annotateAccessibilityTree(cookieDialogSnapshot, cookieItems);

    assert.doesNotMatch(contextTree, /→ E/);
    assert.doesNotMatch(contextTree, /button "Aceptar todas"/);
    assert.doesNotMatch(contextTree, /searchbox "¿Adónde\?"/);
    assert.match(contextTree, /dialog "Usamos cookies"/);
  });

  it('keeps unmatched nodes as structural context', () => {
    const contextTree = annotateAccessibilityTree(cookieDialogSnapshot, [
      item({
        shortId: 'E1',
        tagName: 'input',
        role: 'searchbox',
        name: '¿Adónde?',
        index: 0,
      }),
    ]);

    assert.match(contextTree, /dialog "Usamos cookies"/);
    assert.match(contextTree, /button "Aceptar todas"/);
    assert.doesNotMatch(contextTree, /searchbox "¿Adónde\?"/);
    assert.doesNotMatch(contextTree, /→ E/);
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

    const contextTree = annotateAccessibilityTree(snapshot, items);
    assert.equal(contextTree, '- listbox "Sugerencias"');
  });

  it('returns empty string for empty snapshot', () => {
    assert.equal(annotateAccessibilityTree('', cookieItems), '');
    assert.equal(annotateAccessibilityTree('   ', cookieItems), '');
  });

  it('returns empty when every node matches inventory', () => {
    const snapshot = `- button "Go"`;
    const items = [
      item({
        shortId: 'E1',
        role: 'button',
        name: 'Go',
        index: 0,
      }),
    ];

    assert.equal(annotateAccessibilityTree(snapshot, items), '');
  });

  it('truncates very large trees', () => {
    const lines = Array.from({ length: 500 }, (_, index) => `- heading "Section ${index}"`);
    const snapshot = lines.join('\n');
    const items = [
      item({
        shortId: 'E1',
        role: 'heading',
        name: 'Section 0',
        index: 0,
      }),
    ];

    const contextTree = annotateAccessibilityTree(snapshot, items, { maxChars: 500 });
    assert.ok(contextTree.length <= 600);
    assert.match(contextTree, /tree truncated/);
  });

  it('strips Playwright ref and box metadata from context lines', () => {
    const snapshot = `- navigation "Shortcuts" [ref=e3] [box=0,12,420,455]
  - link "Skip" [ref=e4] [cursor=pointer] [box=0,56,124,20]`;

    const contextTree = annotateAccessibilityTree(snapshot, []);
    assert.doesNotMatch(contextTree, /\[ref=/);
    assert.doesNotMatch(contextTree, /\[box=/);
    assert.match(contextTree, /navigation "Shortcuts"/);
    assert.match(contextTree, /link "Skip"/);
  });

  it('does not match generic containers to inventory without a name', () => {
    const snapshot = `- generic [ref=e2] [box=0,0,1920,6304]
  - button "Aceptar" [ref=e21] [box=290,988,70,30]`;

    const items: InventoryItem[] = [
      item({
        shortId: 'E2',
        tagName: 'input',
        role: null,
        name: null,
        ariaLabel: 'Aceptar',
        index: 1,
      }),
      item({
        shortId: 'E34',
        tagName: 'span',
        role: null,
        name: null,
        textPreview: 'Aceptar',
        boundingBox: { x: 290, y: 988, width: 70, height: 30 },
        index: 33,
      }),
    ];

    const contextTree = annotateAccessibilityTree(snapshot, items);
    assert.match(contextTree, /generic/);
    assert.doesNotMatch(contextTree, /button "Aceptar"/);
  });

  it('matches nodes using box suffixes from ai aria snapshots', () => {
    const snapshot = `- button "Filter" [ref=e1] [box=10,20,100,30]
- button "Filter" [ref=e2] [box=200,20,100,30]`;

    const items: InventoryItem[] = [
      item({
        shortId: 'E9',
        role: 'button',
        name: 'Filter',
        boundingBox: { x: 10, y: 20, width: 100, height: 30 },
        index: 0,
      }),
    ];

    const contextTree = annotateAccessibilityTree(snapshot, items);
    assert.doesNotMatch(contextTree, /\[ref=e1\]/);
    assert.match(contextTree, /button "Filter"/);
    assert.equal(contextTree.split('\n').filter((line) => line.includes('Filter')).length, 1);
  });
});
