import type { Page } from 'playwright';
import type { InventoryItem } from '@metamorph/core';
import { captureAccessibilitySnapshot } from './capture-accessibility-snapshot.js';
import { loadBrowserScanScript } from './load-browser-scan-script.js';
import {
  DEFAULT_MAX_A11Y_PROMOTIONS,
  mergeDomAndPromotedInventory,
  promoteA11yInventoryItems,
} from './promote-a11y-inventory-items.js';

export type ScannedInventoryWithAccessibility = {
  items: InventoryItem[];
  accessibilitySnapshot: string;
  labeledCount: number;
};

export type ScanInventoryOptions = {
  maxItems?: number;
  paintLabels?: boolean;
};

export async function scanInventoryWithAccessibility(
  page: Page,
  options: ScanInventoryOptions = {},
): Promise<ScannedInventoryWithAccessibility> {
  const maxItems = options.maxItems ?? Number.POSITIVE_INFINITY;
  const paintLabels = options.paintLabels ?? false;
  const accessibilitySnapshot = await captureAccessibilitySnapshot(page);

  const browserScript = loadBrowserScanScript();
  const domItems = (await page.evaluate(
    ({ script, opts }) => {
      const api = (0, eval)(`${script}\n; __metamorphInventory`) as {
        scanAndLabelPage: (options: {
          maxItems?: number;
          paintLabels?: boolean;
        }) => unknown[];
      };
      return api.scanAndLabelPage(opts);
    },
    { script: browserScript, opts: { maxItems, paintLabels } },
  )) as InventoryItem[];

  const promotionBudget = Number.isFinite(maxItems)
    ? Math.max(0, maxItems - domItems.length)
    : DEFAULT_MAX_A11Y_PROMOTIONS;

  const { enrichedDom, promoted } = await promoteA11yInventoryItems(
    page,
    accessibilitySnapshot,
    domItems,
    { maxPromotions: promotionBudget },
  );

  let items = mergeDomAndPromotedInventory(enrichedDom, promoted);

  if (paintLabels) {
    const toPaint = items
      .filter((item) => !item.labelShown && item.boundingBox)
      .map((item) => ({
        shortId: item.shortId,
        boundingBox: item.boundingBox!,
      }));

    if (toPaint.length > 0) {
      const paintedIds = (await page.evaluate(
        ({ script, payload }) => {
          const api = (0, eval)(`${script}\n; __metamorphInventory`) as {
            paintAdditionalInventoryLabels: (
              items: typeof payload,
            ) => string[];
          };
          return api.paintAdditionalInventoryLabels(payload);
        },
        { script: browserScript, payload: toPaint },
      )) as string[];

      const paintedSet = new Set(paintedIds);
      items = items.map((item) =>
        paintedSet.has(item.shortId) ? { ...item, labelShown: true } : item,
      );
    }
  }

  return {
    items,
    accessibilitySnapshot,
    labeledCount: items.filter((item) => item.labelShown).length,
  };
}
