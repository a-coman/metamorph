import { chromium, type BrowserContext, type Locator, type Page } from 'playwright';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  GOTO_WAIT_UNTIL,
  resolveStepFillBehavior,
  resolveInventoryItemTargetCandidates,
  shouldStabilizeAfterAction,
  type InventoryItem,
  type PageSnapshotInventory,
  type ResolvedInventoryTarget,
  type SlotStep,
} from '@metamorph/core';
import {
  buildBrowserContextOptions,
  captureViewportScreenshot,
  fillWithAutocomplete,
  resolveUniqueTargetLocator,
  scanAndEnrichCurrentPage,
  stabilizePage,
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
        let screenshotBeforeStep = await captureViewportScreenshot(page);

        for (let index = 0; index < steps.length; index++) {
          if (sessionId && (await sessionControlChecker.isPauseRequested(sessionId))) {
            throw new ProbeInventoryCaptureError('Session paused by user', null);
          }

          const step = steps[index]!;
          const urlBeforeFailure = page.url();
          const beforeScreenshot = screenshotBeforeStep;

          try {
            await this.executeStep(page, step, inventory);
            screenshotBeforeStep = await captureViewportScreenshot(page);
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
        await (await resolveTarget(page, step, itemMap)).click();
        break;

      case 'fill': {
        const fillLocator = await resolveTarget(page, step, itemMap);
        const fillValue = step.value ?? '';

        if (resolveStepFillBehavior(step) === 'autocomplete') {
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
        await (await resolveTarget(page, step, itemMap)).selectOption(step.value ?? '');
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

/**
 * Collects target candidates for a step (compile-time resolved target first,
 * then the inventory item's own candidates) and resolves the first one that
 * matches exactly one element on the live page. Recounting at action time
 * catches pages that drifted since the snapshot; the fallback chain lets a
 * stale primary locator self-heal via the alternatives.
 */
async function resolveTarget(
  page: Page,
  step: SlotStep,
  itemMap: Map<string, InventoryItem>,
): Promise<Locator> {
  const candidates: ResolvedInventoryTarget[] = [];
  const seen = new Set<string>();

  const push = (candidate: ResolvedInventoryTarget) => {
    const key =
      candidate.kind === 'selector'
        ? `locator(${JSON.stringify(candidate.value)})`
        : candidate.value;
    if (!seen.has(key)) {
      seen.add(key);
      candidates.push(candidate);
    }
  };

  if (step.resolved_locator) {
    push({ kind: 'locator', value: step.resolved_locator });
  }
  if (step.resolved_selector) {
    push({ kind: 'selector', value: step.resolved_selector });
  }

  const item = step.element_id ? itemMap.get(step.element_id) : undefined;
  if (item) {
    for (const candidate of resolveInventoryItemTargetCandidates(item)) {
      push(candidate);
    }
  }

  if (candidates.length === 0) {
    if (!step.element_id) {
      throw new Error(`Step ${step.id}: ${step.action} requires element_id`);
    }
    throw new Error(`element_id ${step.element_id} not found in inventory`);
  }

  const description = step.element_id
    ? `step ${step.id} (${step.action} ${step.element_id})`
    : `step ${step.id} (${step.action})`;

  return resolveUniqueTargetLocator(page, candidates, description);
}
