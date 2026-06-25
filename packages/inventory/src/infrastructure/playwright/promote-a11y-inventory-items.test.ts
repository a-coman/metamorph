import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { InventoryItem } from '@metamorph/core';
import {
  buildA11yLocator,
  findDomItemForEnrichment,
  isPromotableA11yLine,
  parseA11ySnapshot,
} from './a11y-snapshot-lines.js';
import { listA11yPromotionCandidates } from './promote-a11y-inventory-items.js';

function domItem(
  overrides: Partial<InventoryItem> & Pick<InventoryItem, 'shortId'>,
): InventoryItem {
  return {
    index: 0,
    locator: null,
    selector: '#x',
    score: 100,
    labelShown: true,
    tagName: 'input',
    id: null,
    role: 'searchbox',
    name: 'Search',
    ariaLabel: null,
    textPreview: null,
    ...overrides,
  };
}

describe('listA11yPromotionCandidates', () => {
  it('promotes unmatched interactable nodes with names', () => {
    const snapshot = `- dialog "Cookies"
  - button "Accept all"
  - link "Privacy policy"
- searchbox "Search"`;

    const domItems: InventoryItem[] = [
      domItem({
        shortId: 'E1',
        role: 'searchbox',
        name: 'Search',
        tagName: 'input',
        index: 0,
      }),
    ];

    const candidates = listA11yPromotionCandidates(snapshot, domItems);
    const roles = candidates.map((line) => line.role);

    assert.ok(roles.includes('button'));
    assert.ok(roles.includes('link'));
    assert.equal(candidates.filter((line) => line.role === 'searchbox').length, 0);
  });

  it('skips generic containers and unnamed interactables', () => {
    const snapshot = `- generic [ref=e1] [box=0,0,100,100]
  - button
  - link "Details"`;

    const candidates = listA11yPromotionCandidates(snapshot, []);
    assert.equal(candidates.length, 1);
    assert.equal(candidates[0]!.role, 'link');
  });

  it('builds getByRole locators from promoted lines', () => {
    const line = parseA11ySnapshot(`- link "HUAWEI"`)[0]!;
    assert.equal(
      buildA11yLocator(line),
      'getByRole("link", { name: "HUAWEI" })',
    );
    assert.equal(isPromotableA11yLine(line), true);
  });

  it('prioritizes checkbox promotions ahead of combobox options', () => {
    const snapshot = `- combobox "Department"
  - option "Books"
  - option "Electronics"
  - checkbox "OPPO"
  - checkbox "TCL"`;

    const candidates = listA11yPromotionCandidates(snapshot, []);
    const roles = candidates.map((line) => line.role);

    assert.equal(roles[0], 'checkbox');
    assert.equal(roles[1], 'checkbox');
    assert.ok(roles.includes('option'));
    assert.ok(roles.indexOf('checkbox') < roles.indexOf('option'));
  });

  it('finds enrichable DOM items by box overlap and compatible roles', () => {
    const line = parseA11ySnapshot(
      `- checkbox "Aplicar filtro de Sony para reducir los resultados" [box=92,622,32,16]`,
    )[0]!;

    const domItems: InventoryItem[] = [
      domItem({
        shortId: 'E5',
        role: 'link',
        tagName: 'a',
        textPreview: 'Sony',
        boundingBox: { x: 92, y: 622, width: 32, height: 16 },
        index: 4,
      }),
    ];

    assert.equal(findDomItemForEnrichment(domItems, line), 0);
  });
});
