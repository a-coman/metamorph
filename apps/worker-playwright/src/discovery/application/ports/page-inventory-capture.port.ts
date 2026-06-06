import type { PageInventory } from '@metamorph/inventory';
import type { Browser } from 'playwright';

export abstract class PageInventoryCapturePort {
  abstract capture(browser: Browser, url: string): Promise<PageInventory>;
}
