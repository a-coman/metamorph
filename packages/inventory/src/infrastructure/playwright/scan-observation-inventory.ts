import type { Page } from 'playwright';
import type { InventoryItem } from '@metamorph/core';
import { evaluatePageFunction } from './evaluate-browser-function.js';
import { scanObservationPage } from './inventory.browser.js';

export type ScanObservationInventoryOptions = {
  maxItems?: number;
};

export async function scanObservationInventory(
  page: Page,
  options: ScanObservationInventoryOptions = {},
): Promise<InventoryItem[]> {
  return evaluatePageFunction(page, scanObservationPage, options);
}
