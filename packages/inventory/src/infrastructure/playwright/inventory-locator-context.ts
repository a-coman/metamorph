import type { Frame, Page } from 'playwright';

/** Page or Frame scope for aria-ref resolution and in-context locator chains. */
export type InventoryLocatorScope = Page | Frame;

export function isPageScope(scope: InventoryLocatorScope): scope is Page {
  return typeof (scope as Page).viewportSize === 'function';
}
