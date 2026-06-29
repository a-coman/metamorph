import type { Page } from 'playwright';
import type {
  BuildPageInventoryOptions,
  PageInventory,
} from '../../domain/types/inventory-item.types.js';
import { PageInventoryBuilderPort } from '../../domain/repositories/page-inventory-builder.repository.port.js';
import { DEFAULT_MAX_CAPTURE_HEIGHT, DEFAULT_MAX_ITEMS } from './capture-defaults.js';
import {
  captureAnnotatedScreenshot,
  captureRawScreenshot,
  prepareCaptureViewport,
} from './prepare-viewport.js';
import { scanInventoryWithAccessibility } from './scan-inventory-with-accessibility.js';
import { scanObservationInventory } from './scan-observation-inventory.js';
import { annotateAccessibilityTree } from './annotate-accessibility-tree.js';

export class PlaywrightInventoryBuilderAdapter extends PageInventoryBuilderPort {
  async buildFromPage(
    page: Page,
    url: string,
    options: BuildPageInventoryOptions = {},
  ): Promise<PageInventory> {
    const {
      waitAfterGotoMs = 2000,
      waitAfterViewportMs = 500,
      maxCaptureHeight = DEFAULT_MAX_CAPTURE_HEIGHT,
      maxItems = DEFAULT_MAX_ITEMS,
      gotoWaitUntil = 'domcontentloaded',
    } = options;

    await page.route(/\.(woff2?|ttf|otf|eot)(\?.*)?$/i, (route) => route.abort());

    await page.goto(url, { waitUntil: gotoWaitUntil });
    await page.waitForTimeout(waitAfterGotoMs);

    const { pageMetrics, viewport } = await prepareCaptureViewport(
      page,
      maxCaptureHeight,
      waitAfterViewportMs,
    );

    const rawScreenshot = await captureRawScreenshot(page);

    const observationItems = await scanObservationInventory(page, { maxItems });

    const { items, accessibilitySnapshot, labeledCount } =
      await scanInventoryWithAccessibility(page, { maxItems, paintLabels: true });

    const screenshot = await captureAnnotatedScreenshot(page);

    const accessibilityTreeAnnotated = accessibilitySnapshot
      ? annotateAccessibilityTree(accessibilitySnapshot, items)
      : undefined;

    const inventory: PageInventory = {
      url: page.url() || url,
      capturedAt: new Date().toISOString(),
      pageMetrics,
      viewport,
      items,
      observationItems,
      rawScreenshot,
      screenshot,
      labeledCount,
      ...(accessibilitySnapshot ? { accessibilitySnapshot } : {}),
      ...(accessibilityTreeAnnotated ? { accessibilityTreeAnnotated } : {}),
    };

    return inventory;
  }
}
