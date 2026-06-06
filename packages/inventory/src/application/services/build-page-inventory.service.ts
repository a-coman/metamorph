import type { Browser, Page } from 'playwright';
import type {
  BuildPageInventoryOptions,
  PageInventory,
} from '../../domain/types/inventory-item.types.js';
import { PageInventoryBuilderPort } from '../../domain/repositories/page-inventory-builder.repository.port.js';
import { PlaywrightInventoryBuilderAdapter } from '../../infrastructure/playwright/inventory-builder.adapter.js';

export class BuildPageInventoryService {
  constructor(
    private readonly builder: PageInventoryBuilderPort = new PlaywrightInventoryBuilderAdapter(),
  ) {}

  async fromPage(
    page: Page,
    url: string,
    options?: BuildPageInventoryOptions,
  ): Promise<PageInventory> {
    return this.builder.buildFromPage(page, url, options);
  }

  async fromBrowser(
    browser: Browser,
    url: string,
    options?: BuildPageInventoryOptions,
  ): Promise<PageInventory> {
    const context = await browser.newContext({
      viewport: { width: 1280, height: 720 },
    });
    const page = await context.newPage();

    try {
      return await this.fromPage(page, url, options);
    } finally {
      await context.close();
    }
  }
}

export async function buildPageInventory(
  browser: Browser,
  url: string,
  options?: BuildPageInventoryOptions,
): Promise<PageInventory> {
  const service = new BuildPageInventoryService();
  return service.fromBrowser(browser, url, options);
}
