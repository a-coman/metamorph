import type { Page } from 'playwright';
import type { InventoryItem } from '@metamorph/core';
import { annotateAccessibilityTree } from './annotate-accessibility-tree.js';
import { captureAccessibilitySnapshot } from './capture-accessibility-snapshot.js';
import { loadBrowserScanScript } from './load-browser-scan-script.js';

export type ScannedInventoryWithAccessibility = {
  items: InventoryItem[];
  accessibilitySnapshot: string;
  accessibilityTreeAnnotated: string;
  labeledCount: number;
};

export async function scanInventoryWithAccessibility(
  page: Page,
  maxItems: number,
): Promise<ScannedInventoryWithAccessibility> {
  const accessibilitySnapshot = await captureAccessibilitySnapshot(page);

  const browserScript = loadBrowserScanScript();
  const items = (await page.evaluate(
    ({ script, opts }) => {
      const api = (0, eval)(`${script}\n; __metamorphInventory`) as {
        scanAndLabelPage: (options: { maxItems: number }) => unknown[];
      };
      return api.scanAndLabelPage(opts);
    },
    { script: browserScript, opts: { maxItems } },
  )) as InventoryItem[];

  const accessibilityTreeAnnotated = annotateAccessibilityTree(accessibilitySnapshot, items);

  return {
    items,
    accessibilitySnapshot,
    accessibilityTreeAnnotated,
    labeledCount: items.filter((item) => item.labelShown).length,
  };
}
