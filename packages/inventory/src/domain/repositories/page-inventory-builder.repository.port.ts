import type { Page } from 'playwright';
import type {
  BuildPageInventoryOptions,
  PageInventory,
} from '../types/inventory-item.types.js';

export abstract class PageInventoryBuilderPort {
  abstract buildFromPage(
    page: Page,
    url: string,
    options?: BuildPageInventoryOptions,
  ): Promise<PageInventory>;
}
