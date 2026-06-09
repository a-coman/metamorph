import { chromium, type BrowserContext, type Page } from 'playwright';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  GOTO_WAIT_UNTIL,
  POST_ACTION_SETTLE_MS,
  shouldStabilizeAfterAction,
  type InventoryItem,
  type PageSnapshotInventory,
  type SlotStep,
} from '@metamorph/core';
import {
  captureAnnotatedScreenshot,
  loadBrowserScanScript,
  prepareCaptureViewport,
  type PageInventory,
} from '@metamorph/inventory';
import { ProbeInventoryCaptureError } from '../../domain/errors/probe-capture.errors.js';

export type ProbeCaptureResult = {
  inventory: PageInventory;
  traceZip: Buffer | null;
};

export class ProbeInventoryCaptureAdapter {
  async captureAfterSteps(
    steps: SlotStep[],
    inventory: PageSnapshotInventory,
    jobId: string,
  ): Promise<ProbeCaptureResult> {
    const browser = await chromium.launch({
      headless: process.env.PLAYWRIGHT_HEADLESS !== 'false',
      args: ['--disable-dev-shm-usage'],
    });

    const context = await browser.newContext({
      viewport: { width: 1280, height: 720 },
      locale: 'es-ES',
      extraHTTPHeaders: {
        'Accept-Language': 'es-ES,es;q=0.9',
      },
    });

    let tracingStarted = false;
    let traceZip: Buffer | null = null;

    try {
      await context.tracing.start({
        screenshots: true,
        snapshots: true,
        sources: true,
        title: `probe-${jobId}`,
      });
      tracingStarted = true;

      const page = await context.newPage();
      await page.route(/\.(woff2?|ttf|otf|eot)(\?.*)?$/i, (route) => route.abort());

      try {
        for (const step of steps) {
          await this.executeStep(page, step, inventory);
        }

        await stabilizePage(page);

        const pageInventory = await this.scanCurrentPage(page);
        traceZip = await this.exportTrace(context, jobId, tracingStarted);

        return { inventory: pageInventory, traceZip };
      } catch (stepError) {
        traceZip = await this.exportTrace(context, jobId, tracingStarted);
        const partialInventory = await this.tryScanCurrentPage(page);
        const message =
          stepError instanceof Error ? stepError.message : 'Unknown probe capture error';

        throw new ProbeInventoryCaptureError(message, traceZip, {
          cause: stepError,
          partialInventory,
        });
      }
    } catch (error) {
      if (!(error instanceof ProbeInventoryCaptureError)) {
        traceZip = await this.exportTrace(context, jobId, tracingStarted);
        const message =
          error instanceof Error ? error.message : 'Unknown probe capture error';

        throw new ProbeInventoryCaptureError(message, traceZip, { cause: error });
      }

      throw error;
    } finally {
      await context.close().catch(() => undefined);
      await browser.close().catch(() => undefined);
    }
  }

  private async exportTrace(
    context: BrowserContext,
    _jobId: string,
    tracingStarted: boolean,
  ): Promise<Buffer | null> {
    if (!tracingStarted) {
      return null;
    }

    const dir = await mkdtemp(join(tmpdir(), 'metamorph-probe-'));
    const tracePath = join(dir, 'trace.zip');

    try {
      await context.tracing.stop({ path: tracePath });
      return await readFile(tracePath);
    } catch {
      return null;
    } finally {
      await rm(dir, { recursive: true, force: true }).catch(() => undefined);
    }
  }

  private async tryScanCurrentPage(page: Page): Promise<PageInventory | null> {
    try {
      return await this.scanCurrentPage(page);
    } catch {
      return null;
    }
  }

  private async scanCurrentPage(page: Page): Promise<PageInventory> {
    await page.waitForTimeout(500);

    const { pageMetrics, viewport } = await prepareCaptureViewport(
      page,
      4_000,
      500,
    );

    const browserScript = loadBrowserScanScript();
    const items = (await page.evaluate(
      ({ script, opts }) => {
        const api = (0, eval)(`${script}\n; __metamorphInventory`) as {
          scanAndLabelPage: (options: { maxItems: number }) => unknown[];
        };
        return api.scanAndLabelPage(opts);
      },
      { script: browserScript, opts: { maxItems: 200 } },
    )) as InventoryItem[];

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

  private async executeStep(
    page: Page,
    step: SlotStep,
    inventory: PageSnapshotInventory,
  ): Promise<void> {
    const itemMap = new Map(inventory.items.map((item) => [item.shortId, item]));

    switch (step.action) {
      case 'goto':
        if (!step.url) {
          throw new Error(`Step ${step.id}: goto requires url`);
        }
        await page.goto(step.url, { waitUntil: GOTO_WAIT_UNTIL });
        break;

      case 'click':
        await resolveTarget(page, step, itemMap).click();
        break;

      case 'fill': {
        const fillLocator = resolveTarget(page, step, itemMap);
        const fillValue = step.value ?? '';
        try {
          await fillLocator.fill(fillValue);
        } catch {
          await fillLocator.click();
          await page.keyboard.type(fillValue);
        }
        break;
      }

      case 'selectOption':
        await resolveTarget(page, step, itemMap).selectOption(step.value ?? '');
        break;

      case 'press':
        await page.keyboard.press(step.key ?? 'Enter');
        break;

      case 'scroll':
        await page.evaluate((y) => window.scrollBy(0, y), step.scroll_y ?? 500);
        break;

      case 'waitFor':
        await page.waitForTimeout(step.timeout_ms ?? 2000);
        break;

      default:
        throw new Error(`Unsupported action: ${step.action}`);
    }

    if (shouldStabilizeAfterAction(step.action)) {
      await stabilizePage(page);
    }
  }
}

async function stabilizePage(page: Page): Promise<void> {
  await page.waitForLoadState(GOTO_WAIT_UNTIL).catch(() => undefined);
  await page.waitForTimeout(POST_ACTION_SETTLE_MS);
}

function resolveTarget(
  page: Page,
  step: SlotStep,
  itemMap: Map<string, import('@metamorph/core').InventoryItem>,
) {
  if (step.resolved_locator) {
    const fn = new Function('page', `return page.${step.resolved_locator}`);
    return fn(page) as ReturnType<Page['locator']>;
  }

  if (step.resolved_selector) {
    return page.locator(step.resolved_selector);
  }

  if (!step.element_id) {
    throw new Error(`Step ${step.id}: ${step.action} requires element_id`);
  }

  const item = itemMap.get(step.element_id);
  if (!item) {
    throw new Error(`element_id ${step.element_id} not found in inventory`);
  }

  if (item.locator) {
    const fn = new Function('page', `return page.${item.locator}`);
    return fn(page) as ReturnType<Page['locator']>;
  }

  return page.locator(item.selector);
}
