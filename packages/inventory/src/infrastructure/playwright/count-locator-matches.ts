import type { Page } from 'playwright';
import { evaluateLocatorChain } from './evaluate-locator-chain.js';

export async function countLocatorMatches(page: Page, locatorChain: string): Promise<number> {
  try {
    const locator = evaluateLocatorChain(page, locatorChain);
    return await locator.count();
  } catch {
    return 0;
  }
}
