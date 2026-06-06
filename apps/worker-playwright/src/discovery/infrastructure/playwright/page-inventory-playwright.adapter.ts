import { buildPageInventory } from '@metamorph/inventory';
import type { Browser } from 'playwright';
import { PageInventoryCapturePort } from '../../application/ports/page-inventory-capture.port.js';

export class PageInventoryPlaywrightAdapter extends PageInventoryCapturePort {
  async capture(browser: Browser, url: string) {
    return buildPageInventory(browser, url);
  }
}
