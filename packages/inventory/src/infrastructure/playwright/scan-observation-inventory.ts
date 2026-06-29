import type { Page } from 'playwright';
import type { InventoryItem } from '@metamorph/core';
import { loadBrowserScanScript } from './load-browser-scan-script.js';

export type ScanObservationInventoryOptions = {
  maxItems?: number;
};

export async function scanObservationInventory(
  page: Page,
  options: ScanObservationInventoryOptions = {},
): Promise<InventoryItem[]> {
  const browserScript = loadBrowserScanScript();
  return (await page.evaluate(
    ({ script, opts }) => {
      const api = (0, eval)(`${script}\n; __metamorphInventory`) as {
        scanObservationPage: (options: { maxItems?: number }) => unknown[];
      };
      return api.scanObservationPage(opts);
    },
    { script: browserScript, opts: options },
  )) as InventoryItem[];
}
