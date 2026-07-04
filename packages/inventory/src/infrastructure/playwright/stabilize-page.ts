import type { Page } from 'playwright';
import {
  GOTO_WAIT_UNTIL,
  LOAD_STATE_TIMEOUT_MS,
  NETWORK_IDLE_LOAD_TIMEOUT_MS,
  NETWORK_IDLE_WAIT_UNTIL,
  POST_ACTION_SETTLE_MS,
} from '@metamorph/core';

/** Post-navigation settle — shared by discover capture and probe step execution. */
export async function stabilizePage(page: Page): Promise<void> {
  await page
    .waitForLoadState(GOTO_WAIT_UNTIL, { timeout: LOAD_STATE_TIMEOUT_MS })
    .catch(() => undefined);
  await page
    .waitForLoadState(NETWORK_IDLE_WAIT_UNTIL, { timeout: NETWORK_IDLE_LOAD_TIMEOUT_MS })
    .catch(() => undefined);
  await page.waitForTimeout(POST_ACTION_SETTLE_MS);
}
