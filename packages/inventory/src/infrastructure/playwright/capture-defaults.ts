import type { ViewportSize } from '../../domain/types/inventory-item.types.js';

/** Standard desktop viewport for inventory capture and LLM screenshots. */
export const DEFAULT_CAPTURE_VIEWPORT: ViewportSize = {
  width: 1920,
  height: 1080,
};

/** Max visible capture height (no full-page expansion beyond the viewport cap). */
export const DEFAULT_MAX_CAPTURE_HEIGHT = DEFAULT_CAPTURE_VIEWPORT.height;

/** Max interactive elements labeled and sent to the LLM per snapshot. */
export const DEFAULT_MAX_ITEMS = 100;
