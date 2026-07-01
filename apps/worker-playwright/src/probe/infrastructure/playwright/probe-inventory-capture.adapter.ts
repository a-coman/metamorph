import { chromium, type BrowserContext, type Page } from 'playwright';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  GOTO_WAIT_UNTIL,
  isComboboxInventoryItem,
  LOAD_STATE_TIMEOUT_MS,
  NETWORK_IDLE_LOAD_TIMEOUT_MS,
  NETWORK_IDLE_WAIT_UNTIL,
  POST_ACTION_SETTLE_MS,
  resolveInventoryItemTarget,
  shouldStabilizeAfterAction,
  type InventoryItem,
  type PageSnapshotInventory,
  type SlotStep,
} from '@metamorph/core';
import {
  buildBrowserContextOptions,
  captureRawScreenshot,
  evaluateLocatorChain,
  fillWithAutocomplete,
  scanAndEnrichCurrentPage,
  type PageInventory,
} from '@metamorph/inventory';
import { ProbeInventoryCaptureError } from '../../domain/errors/probe-capture.errors.js';
import { sessionControlChecker } from '../../../shared/infrastructure/session-control/session-control.js';

export type ProbeCaptureResult = {
  inventory: PageInventory;
  traceZip: Buffer | null;
};

export class ProbeInventoryCaptureAdapter {
  async captureAfterSteps(
    steps: SlotStep[],
    inventory: PageSnapshotInventory,
    jobId: string,
    sessionId?: string,
  ): Promise<ProbeCaptureResult> {
    const browser = await chromium.launch({
      headless: process.env.PLAYWRIGHT_HEADLESS !== 'false',
      args: ['--disable-dev-shm-usage'],
    });

    const context = await browser.newContext(buildBrowserContextOptions());

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
        let screenshotBeforeStep = await captureRawScreenshot(page);

        for (let index = 0; index < steps.length; index++) {
          if (sessionId && (await sessionControlChecker.isPauseRequested(sessionId))) {
            throw new ProbeInventoryCaptureError('Session paused by user', null);
          }

          const step = steps[index]!;
          const urlBeforeFailure = page.url();
          const beforeScreenshot = screenshotBeforeStep;

          try {
            await this.executeStep(page, step, inventory);
            screenshotBeforeStep = await captureRawScreenshot(page);
          } catch (stepError) {
            traceZip = await this.exportTrace(context, jobId, tracingStarted);
            tracingStarted = false;
            const partialInventory = await this.tryScanCurrentPage(page);
            const message =
              stepError instanceof Error ? stepError.message : 'Unknown probe capture error';

            throw new ProbeInventoryCaptureError(message, traceZip, {
              cause: stepError,
              partialInventory,
              failureContext: {
                failedStep: step,
                failedStepIndex: index,
                urlBeforeFailure,
                screenshotBeforeFailure: beforeScreenshot,
              },
            });
          }
        }

        await stabilizePage(page);

        traceZip = await this.exportTrace(context, jobId, tracingStarted);
        tracingStarted = false;

        const pageInventory = await this.scanCurrentPage(page);

        return { inventory: pageInventory, traceZip };
      } catch (stepError) {
        if (stepError instanceof ProbeInventoryCaptureError) {
          throw stepError;
        }

        if (traceZip === null) {
          traceZip = await this.exportTrace(context, jobId, tracingStarted);
        }
        tracingStarted = false;
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
        if (traceZip === null) {
          traceZip = await this.exportTrace(context, jobId, tracingStarted);
        }
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
    return scanAndEnrichCurrentPage(page, {
      preserveScrollPosition: true,
    });
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
        const item = step.element_id ? itemMap.get(step.element_id) : undefined;

        if (item && isComboboxInventoryItem(item)) {
          await fillWithAutocomplete(page, fillLocator, fillValue);
        } else {
          try {
            await fillLocator.fill(fillValue);
          } catch {
            await fillLocator.click();
            await page.keyboard.type(fillValue);
          }
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
  await page
    .waitForLoadState(GOTO_WAIT_UNTIL, { timeout: LOAD_STATE_TIMEOUT_MS })
    .catch(() => undefined);
  await page
    .waitForLoadState(NETWORK_IDLE_WAIT_UNTIL, { timeout: NETWORK_IDLE_LOAD_TIMEOUT_MS })
    .catch(() => undefined);
  await page.waitForTimeout(POST_ACTION_SETTLE_MS);
}

function resolveTarget(
  page: Page,
  step: SlotStep,
  itemMap: Map<string, InventoryItem>,
) {
  if (step.resolved_locator) {
    return evaluateLocatorChain(page, step.resolved_locator);
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

  const target = resolveInventoryItemTarget(item);
  if (target.kind === 'locator') {
    return evaluateLocatorChain(page, target.value);
  }

  return page.locator(target.value);
}
