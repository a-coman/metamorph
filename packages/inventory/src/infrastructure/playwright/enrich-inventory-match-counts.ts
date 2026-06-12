import type { Locator, Page } from 'playwright';
import type { InventoryItem } from '@metamorph/core';

export function evaluateLocatorChain(page: Page, locatorChain: string): Locator {
  const fn = new Function('page', `return page.${locatorChain}`);
  return fn(page) as Locator;
}

export async function enrichInventoryMatchCounts(
  page: Page,
  items: InventoryItem[],
): Promise<InventoryItem[]> {
  return Promise.all(
    items.map(async (item) => {
      let locatorMatchCount: number | undefined;
      let selectorMatchCount: number | undefined;

      if (item.locator) {
        try {
          locatorMatchCount = await evaluateLocatorChain(
            page,
            item.locator,
          ).count();
        } catch {
          locatorMatchCount = undefined;
        }
      }

      try {
        selectorMatchCount = await page.locator(item.selector).count();
      } catch {
        selectorMatchCount = undefined;
      }

      return {
        ...item,
        ...(locatorMatchCount !== undefined ? { locatorMatchCount } : {}),
        ...(selectorMatchCount !== undefined ? { selectorMatchCount } : {}),
      };
    }),
  );
}
