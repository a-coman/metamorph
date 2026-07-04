import type { ViewportSize } from '../../domain/types/inventory-item.types.js';

/** Standard desktop viewport for inventory capture and LLM screenshots. */
export const DEFAULT_CAPTURE_VIEWPORT: ViewportSize = {
  width: 1920,
  height: 1080,
};

/** Max visible capture height (no full-page expansion beyond the viewport cap). */
export const DEFAULT_MAX_CAPTURE_HEIGHT = DEFAULT_CAPTURE_VIEWPORT.height;

/** Default cap for action and observation inventory after merge (tier1 controls ranked first). */
export const DEFAULT_MAX_INVENTORY_ITEMS = 300;

export { DEFAULT_MAX_A11Y_TREE_CHARS } from '@metamorph/core';

/** Browser locale for probes and inventory capture. Override with PLAYWRIGHT_LOCALE. */
export const DEFAULT_BROWSER_LOCALE = process.env.PLAYWRIGHT_LOCALE ?? 'es-ES';

export function buildBrowserContextOptions() {
  return {
    viewport: DEFAULT_CAPTURE_VIEWPORT,
    locale: DEFAULT_BROWSER_LOCALE,
    extraHTTPHeaders: {
      'Accept-Language': `${DEFAULT_BROWSER_LOCALE},en;q=0.9`,
    },
  };
}
