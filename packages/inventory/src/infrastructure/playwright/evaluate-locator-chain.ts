import type { Locator, Page } from 'playwright';

export function evaluateLocatorChain(page: Page, locatorChain: string): Locator {
  const fn = new Function('page', `return page.${locatorChain}`);
  return fn(page) as Locator;
}
