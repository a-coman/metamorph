import type { Page } from 'playwright';
import type { InventoryItem } from '@metamorph/core';
import {
  buildA11yInventory,
  shouldResnapshotA11yInventory,
} from './build-a11y-inventory.js';
import { captureAccessibilitySnapshot } from './capture-accessibility-snapshot.js';
import { evaluatePageFunction } from './evaluate-browser-function.js';
import {
  paintAdditionalInventoryLabels,
  scanAndLabelPage,
} from './inventory.browser.js';
import { DEFAULT_MAX_INVENTORY_ITEMS } from './capture-defaults.js';
import { INVENTORY_SCAN_CONFIG } from './inventory-scan-config.js';
import {
  appendSupplementalDomItems,
  assignInventoryShortIds,
  capInventoryItems,
  enrichA11yItemsFromDomItems,
  filterSupplementalDomItems,
} from './merge-inventory-items.js';
import { formatLocatorSegment } from './parse-locator-chain.js';
import { runInParallelBatches } from './run-in-parallel-batches.js';
import { scanFrameInventories } from './scan-frame-inventories.js';

export type ScannedInventoryWithAccessibility = {
  items: InventoryItem[];
  accessibilitySnapshot: string;
  labeledCount: number;
};

export type ScanInventoryOptions = {
  maxItems?: number;
  paintLabels?: boolean;
};

const VALIDATION_CONCURRENCY = 8;

function resolveMaxItems(maxItems?: number): number {
  return maxItems ?? DEFAULT_MAX_INVENTORY_ITEMS;
}

async function validateDomSelectorCounts(
  page: Page,
  items: InventoryItem[],
): Promise<InventoryItem[]> {
  return runInParallelBatches(items, VALIDATION_CONCURRENCY, async (item) => {
    try {
      const selectorMatchCount = await page.locator(item.selector).count();
      return { ...item, selectorMatchCount };
    } catch {
      return { ...item, selectorMatchCount: 0 };
    }
  });
}

export async function scanInventoryWithAccessibility(
  page: Page,
  options: ScanInventoryOptions = {},
): Promise<ScannedInventoryWithAccessibility> {
  const effectiveMaxItems = resolveMaxItems(options.maxItems);
  const paintLabels = options.paintLabels ?? false;
  let accessibilitySnapshot = await captureAccessibilitySnapshot(page);

  let a11yResult = await buildA11yInventory(page, accessibilitySnapshot);
  if (shouldResnapshotA11yInventory(a11yResult)) {
    accessibilitySnapshot = await captureAccessibilitySnapshot(page);
    a11yResult = await buildA11yInventory(page, accessibilitySnapshot);
  }

  const frameItems = await scanFrameInventories(page);

  const rawDomItems = await evaluatePageFunction(page, scanAndLabelPage, {
    minVisibleSizePx: INVENTORY_SCAN_CONFIG.minVisibleSizePx,
    headerNavBelowFoldPx: INVENTORY_SCAN_CONFIG.headerNavBelowFoldPx,
  });

  // Frame items stay out of the box overlap merge: the main-page DOM scan
  // cannot see into iframes, so overlap with a frame item never means the
  // same element and would only donate wrong-document selectors.
  const enrichedA11y = enrichA11yItemsFromDomItems(a11yResult.items, rawDomItems);
  const supplementalDomItems = filterSupplementalDomItems(rawDomItems, enrichedA11y);
  const validatedSupplements = (
    await validateDomSelectorCounts(page, supplementalDomItems)
  )
    .filter((item) => item.selectorMatchCount === 1)
    .map((item) => ({
      ...item,
      candidates: [formatLocatorSegment(item.selector)],
    }));

  const merged = appendSupplementalDomItems(
    [...enrichedA11y, ...frameItems],
    validatedSupplements,
  );
  const capped = capInventoryItems(merged, effectiveMaxItems);
  let items = assignInventoryShortIds(capped);

  if (paintLabels) {
    const toPaint = items
      .filter((item) => item.boundingBox)
      .map((item) => ({
        shortId: item.shortId,
        boundingBox: item.boundingBox!,
      }));

    if (toPaint.length > 0) {
      const paintedIds = await evaluatePageFunction(
        page,
        paintAdditionalInventoryLabels,
        toPaint,
      );

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
