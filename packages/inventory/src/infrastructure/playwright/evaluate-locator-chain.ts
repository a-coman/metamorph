import type { Page } from 'playwright';
import { buildLocatorFromChain } from './parse-locator-chain.js';

export {
  buildLocatorFromChain,
  formatFrameLocator,
  formatFrameLocatorChain,
  formatGetByRoleLocator,
  formatLocatorSegment,
  parseLocatorSegments,
  type LocatorRoot,
} from './parse-locator-chain.js';

export function evaluateLocatorChain(page: Page, locatorChain: string) {
  return buildLocatorFromChain(page, locatorChain);
}
