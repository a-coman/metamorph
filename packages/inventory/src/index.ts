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

export { scanAndLabelPage } from './infrastructure/playwright/inventory.browser.js';

export {
  captureAnnotatedScreenshot,
  prepareCaptureViewport,
  readPageMetrics,
} from './infrastructure/playwright/prepare-viewport.js';

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
