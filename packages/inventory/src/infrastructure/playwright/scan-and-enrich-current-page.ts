import type { Page } from 'playwright';
import type { InventoryItem } from '@metamorph/core';
import { DEFAULT_MAX_CAPTURE_HEIGHT, DEFAULT_MAX_ITEMS } from './capture-defaults.js';
import {
  captureAnnotatedScreenshot,
  prepareCaptureViewport,
} from './prepare-viewport.js';
import { scanInventoryWithAccessibility } from './scan-inventory-with-accessibility.js';

export type ScanAndEnrichResult = {
  url: string;
  capturedAt: string;
  pageMetrics: { width: number; height: number };
  viewport: { width: number; height: number };
  items: InventoryItem[];
  screenshot: Buffer;
  labeledCount: number;
  accessibilitySnapshot?: string;
  accessibilityTreeAnnotated?: string;
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

  const {
    items,
    accessibilitySnapshot,
    accessibilityTreeAnnotated,
    labeledCount,
  } = await scanInventoryWithAccessibility(page, maxItems);

  const screenshot = await captureAnnotatedScreenshot(page);

  return {
    url: page.url(),
    capturedAt: new Date().toISOString(),
    pageMetrics,
    viewport,
    items,
    screenshot,
    labeledCount,
    ...(accessibilitySnapshot ? { accessibilitySnapshot } : {}),
    ...(accessibilityTreeAnnotated ? { accessibilityTreeAnnotated } : {}),
  };
}
