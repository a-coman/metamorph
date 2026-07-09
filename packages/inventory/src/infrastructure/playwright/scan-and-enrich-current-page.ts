import type { Page } from 'playwright';
import type { InventoryItem } from '@metamorph/core';
import {
  DEFAULT_MAX_CAPTURE_HEIGHT,
  DEFAULT_MAX_INVENTORY_ITEMS,
} from './capture-defaults.js';
import {
  captureViewportScreenshot,
  prepareCaptureViewport,
} from './prepare-viewport.js';
import { clearInventoryLabelsFromPage } from './evaluate-browser-function.js';
import { runWithoutTrace } from './run-without-trace.js';
import { scanInventoryWithAccessibility } from './scan-inventory-with-accessibility.js';
import { scanObservationInventory } from './scan-observation-inventory.js';

export type ScanAndEnrichResult = {
  url: string;
  capturedAt: string;
  pageMetrics: { width: number; height: number };
  viewport: { width: number; height: number };
  items: InventoryItem[];
  observationItems: InventoryItem[];
  rawScreenshot: Buffer;
  screenshot: Buffer;
  labeledCount: number;
  accessibilitySnapshot?: string;
  accessibilityTreeAnnotated?: string;
};

export async function scanAndEnrichCurrentPage(
  page: Page,
  options?: {
    maxItems?: number;
    waitAfterViewportMs?: number;
    preserveScrollPosition?: boolean;
  },
): Promise<ScanAndEnrichResult> {
  const maxItems = options?.maxItems ?? DEFAULT_MAX_INVENTORY_ITEMS;
  const waitAfterViewportMs = options?.waitAfterViewportMs ?? 500;

  const {
    pageMetrics,
    viewport,
    observationItems,
    items,
    accessibilitySnapshot,
    labeledCount,
    rawScreenshot,
    screenshot,
  } = await runWithoutTrace(
    page,
    async () => {
      await page.waitForTimeout(waitAfterViewportMs);

      const { pageMetrics, viewport } = await prepareCaptureViewport(
        page,
        DEFAULT_MAX_CAPTURE_HEIGHT,
        waitAfterViewportMs,
        { preserveScrollPosition: options?.preserveScrollPosition },
      );

      const rawScreenshot = await captureViewportScreenshot(page);

      const observationItems = await scanObservationInventory(page, { maxItems });
      const { items, accessibilitySnapshot, labeledCount } =
        await scanInventoryWithAccessibility(page, { maxItems, paintLabels: true });

      let screenshot: Buffer;
      try {
        screenshot = await captureViewportScreenshot(page);
      } finally {
        await clearInventoryLabelsFromPage(page);
      }

      return {
        pageMetrics,
        viewport,
        observationItems,
        items,
        accessibilitySnapshot,
        labeledCount,
        rawScreenshot,
        screenshot,
      };
    },
    { title: 'Inventory scan' },
  );

  return {
    url: page.url(),
    capturedAt: new Date().toISOString(),
    pageMetrics,
    viewport,
    items,
    observationItems,
    rawScreenshot,
    screenshot,
    labeledCount,
    ...(accessibilitySnapshot ? { accessibilitySnapshot } : {}),
  };
}
