import type { Page } from 'playwright';
import {
  COLLECT_PAGE_READY_METRICS_BODY,
  GOTO_WAIT_UNTIL,
  LOAD_STATE_TIMEOUT_MS,
  NETWORK_IDLE_LOAD_TIMEOUT_MS,
  NETWORK_IDLE_WAIT_UNTIL,
  ADAPTIVE_SETTLE_INITIAL_MS,
  ADAPTIVE_SETTLE_POLL_MS,
  assessPageReady,
  getAdaptiveSettleMaxMs,
  shouldStopAdaptiveSettle,
  type PageReadyMetrics,
  type StabilizePhase,
} from '@metamorph/core';

const collectPageReadyMetrics = new Function(
  COLLECT_PAGE_READY_METRICS_BODY,
) as () => PageReadyMetrics;

async function collectPageReadyMetricsFromPage(page: Page): Promise<PageReadyMetrics> {
  return page.evaluate(collectPageReadyMetrics);
}

async function adaptiveSettle(page: Page, maxMs: number): Promise<void> {
  const start = Date.now();
  let previousBodyTextLength: number | null = null;
  let stablePollCount = 0;

  await page.waitForTimeout(ADAPTIVE_SETTLE_INITIAL_MS);

  while (Date.now() - start < maxMs) {
    const metrics = await collectPageReadyMetricsFromPage(page);
    const decision = shouldStopAdaptiveSettle({
      metrics,
      previousBodyTextLength,
      stablePollCount,
    });

    if (decision.stop) {
      return;
    }

    stablePollCount = decision.nextStablePollCount;
    previousBodyTextLength = metrics.bodyTextLength;
    await page.waitForTimeout(ADAPTIVE_SETTLE_POLL_MS);
  }
}

/** Post-action settle — shared by discover capture and probe step execution. */
export async function stabilizePage(page: Page, phase: StabilizePhase): Promise<void> {
  if (phase === 'after_goto') {
    await page
      .waitForLoadState(NETWORK_IDLE_WAIT_UNTIL, { timeout: NETWORK_IDLE_LOAD_TIMEOUT_MS })
      .catch(() => undefined);
  } else {
    await page
      .waitForLoadState(GOTO_WAIT_UNTIL, { timeout: LOAD_STATE_TIMEOUT_MS })
      .catch(() => undefined);
  }

  await adaptiveSettle(page, getAdaptiveSettleMaxMs(phase));
}

export { assessPageReady, type PageReadyMetrics, type StabilizePhase };
