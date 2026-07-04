import type { Page } from 'playwright';
import type {
  BuildPageInventoryOptions,
  PageInventory,
} from '../../domain/types/inventory-item.types.js';
import { PageInventoryBuilderPort } from '../../domain/repositories/page-inventory-builder.repository.port.js';
import {
  DEFAULT_MAX_CAPTURE_HEIGHT,
  DEFAULT_MAX_INVENTORY_ITEMS,
} from './capture-defaults.js';
import {
  GOTO_WAIT_UNTIL,
  shouldStabilizeAfterAction,
} from '@metamorph/core';
import {
  captureViewportScreenshot,
  prepareCaptureViewport,
} from './prepare-viewport.js';
import { scanInventoryWithAccessibility } from './scan-inventory-with-accessibility.js';
import { scanObservationInventory } from './scan-observation-inventory.js';
import { annotateAccessibilityTree } from './annotate-accessibility-tree.js';
import { stabilizePage } from './stabilize-page.js';

export class PlaywrightInventoryBuilderAdapter extends PageInventoryBuilderPort {
  async buildFromPage(
    page: Page,
    url: string,
    options: BuildPageInventoryOptions = {},
  ): Promise<PageInventory> {
    const {
      waitAfterViewportMs = 500,
      maxCaptureHeight = DEFAULT_MAX_CAPTURE_HEIGHT,
      maxItems = DEFAULT_MAX_INVENTORY_ITEMS,
      gotoWaitUntil = GOTO_WAIT_UNTIL,
    } = options;

    await page.route(/\.(woff2?|ttf|otf|eot)(\?.*)?$/i, (route) => route.abort());

    await page.goto(url, { waitUntil: gotoWaitUntil });
    if (shouldStabilizeAfterAction('goto')) {
      await stabilizePage(page);
    }
    await stabilizePage(page);

    const { pageMetrics, viewport } = await prepareCaptureViewport(
      page,
      maxCaptureHeight,
      waitAfterViewportMs,
    );

    const rawScreenshot = await captureViewportScreenshot(page);

    const observationItems = await scanObservationInventory(page, { maxItems });

    const { items, accessibilitySnapshot, labeledCount } =
      await scanInventoryWithAccessibility(page, { maxItems, paintLabels: true });

    const screenshot = await captureViewportScreenshot(page);

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
