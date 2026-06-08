import {
  PageSnapshotInventorySchema,
  type PageSnapshotInventory,
} from '@metamorph/core';
import type { PageInventory } from '../../domain/types/inventory-item.types.js';

export function toPageSnapshotPayload(
  inventory: PageInventory,
): PageSnapshotInventory {
  const {
    screenshot: _screenshot,
    rawScreenshot: _rawScreenshot,
    ...payload
  } = inventory;
  return PageSnapshotInventorySchema.parse(payload);
}
