import type { Page } from 'playwright';
import type { InventoryItem } from '@metamorph/core';
import { DEFAULT_MAX_CAPTURE_HEIGHT, DEFAULT_MAX_ITEMS } from './capture-defaults.js';
import { enrichInventoryMatchCounts } from './enrich-inventory-match-counts.js';
import { loadBrowserScanScript } from './load-browser-scan-script.js';
import { captureAnnotatedScreenshot, prepareCaptureViewport } from './prepare-viewport.js';

export type ScanAndEnrichResult = {
  url: string;
  capturedAt: string;
  pageMetrics: { width: number; height: number };
  viewport: { width: number; height: number };
  items: InventoryItem[];
  screenshot: Buffer;
  labeledCount: number;
};

export async function scanAndEnrichCurrentPage(
  page: Page,
  options?: { maxItems?: number; waitAfterViewportMs?: number },
): Promise<ScanAndEnrichResult> {
  const maxItems = options?.maxItems ?? DEFAULT_MAX_ITEMS;
  const waitAfterViewportMs = options?.waitAfterViewportMs ?? 500;

  await page.waitForTimeout(waitAfterViewportMs);

  const { pageMetrics, viewport } = await prepareCaptureViewport(
    page,
    DEFAULT_MAX_CAPTURE_HEIGHT,
    waitAfterViewportMs,
  );

  const browserScript = loadBrowserScanScript();
  const scannedItems = (await page.evaluate(
    ({ script, opts }) => {
      const api = (0, eval)(`${script}\n; __metamorphInventory`) as {
        scanAndLabelPage: (options: { maxItems: number }) => unknown[];
      };
      return api.scanAndLabelPage(opts);
    },
    { script: browserScript, opts: { maxItems } },
  )) as InventoryItem[];

  const items = await enrichInventoryMatchCounts(page, scannedItems);
  const screenshot = await captureAnnotatedScreenshot(page);

  return {
    url: page.url(),
    capturedAt: new Date().toISOString(),
    pageMetrics,
    viewport,
    items,
    screenshot,
    labeledCount: items.filter((item) => item.labelShown).length,
  };
}
