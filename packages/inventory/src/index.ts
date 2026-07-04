export type {
  BuildPageInventoryOptions,
  PageInventory,
} from './domain/types/inventory-item.types.js';

export { PageInventoryBuilderPort } from './domain/repositories/page-inventory-builder.repository.port.js';

export {
  BuildPageInventoryService,
  buildPageInventory,
} from './application/services/build-page-inventory.service.js';

export { PlaywrightInventoryBuilderAdapter } from './infrastructure/playwright/inventory-builder.adapter.js';

export {
  scanAndLabelPage,
  scanObservationPage,
} from './infrastructure/playwright/inventory.browser.js';

export { scanObservationInventory } from './infrastructure/playwright/scan-observation-inventory.js';

export {
  DEFAULT_CAPTURE_VIEWPORT,
  DEFAULT_MAX_CAPTURE_HEIGHT,
  DEFAULT_MAX_INVENTORY_ITEMS,
  DEFAULT_MAX_A11Y_TREE_CHARS,
  DEFAULT_BROWSER_LOCALE,
  buildBrowserContextOptions,
} from './infrastructure/playwright/capture-defaults.js';

export {
  captureViewportScreenshot,
  prepareCaptureViewport,
  readPageMetrics,
} from './infrastructure/playwright/prepare-viewport.js';

export { stabilizePage } from './infrastructure/playwright/stabilize-page.js';


export { evaluateLocatorChain } from './infrastructure/playwright/evaluate-locator-chain.js';

export {
  resolveInventoryItemLocator,
  resolveUniqueTargetLocator,
  UniqueTargetResolutionError,
  type ResolveUniqueTargetOptions,
} from './infrastructure/playwright/resolve-unique-target.js';

export { fillWithAutocomplete } from './infrastructure/playwright/fill-with-autocomplete.js';

export { scanAndEnrichCurrentPage } from './infrastructure/playwright/scan-and-enrich-current-page.js';

export { buildA11yInventory, shouldResnapshotA11yInventory } from './infrastructure/playwright/build-a11y-inventory.js';
export { annotateAccessibilityTree } from './infrastructure/playwright/annotate-accessibility-tree.js';
export { captureAccessibilitySnapshot } from './infrastructure/playwright/capture-accessibility-snapshot.js';

export { toPageSnapshotPayload } from './application/mappers/page-snapshot.mapper.js';

export {
  InventoryItemSchema,
  PageMetricsSchema,
  PageSnapshotInventorySchema,
  ViewportSizeSchema,
  type InventoryItem,
  type PageMetrics,
  type PageSnapshotInventory,
  type ViewportSize,
} from '@metamorph/core';
