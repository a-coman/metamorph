import type { Page } from 'playwright';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { InventoryItem } from '@metamorph/core';
import type {
  BuildPageInventoryOptions,
  PageInventory,
} from '../../domain/types/inventory-item.types.js';
import { PageInventoryBuilderPort } from '../../domain/repositories/page-inventory-builder.repository.port.js';
import {
  captureAnnotatedScreenshot,
  prepareCaptureViewport,
} from './prepare-viewport.js';

const DEFAULT_MAX_ITEMS = 200;
const browserBundlePath = join(
  dirname(fileURLToPath(import.meta.url)),
  'inventory.browser.bundle.js',
);

function loadBrowserScanScript(): string {
  return readFileSync(browserBundlePath, 'utf8');
}

export class PlaywrightInventoryBuilderAdapter extends PageInventoryBuilderPort {
  async buildFromPage(
    page: Page,
    url: string,
    options: BuildPageInventoryOptions = {},
  ): Promise<PageInventory> {
    const {
      waitAfterGotoMs = 2000,
      waitAfterViewportMs = 500,
      maxCaptureHeight = 4_000,
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

    const screenshot = await captureAnnotatedScreenshot(page);

    const inventory: PageInventory = {
      url: page.url() || url,
      capturedAt: new Date().toISOString(),
      pageMetrics,
      viewport,
      items,
      screenshot,
      labeledCount: items.filter((item) => item.labelShown).length,
    };

    return inventory;
  }
}
