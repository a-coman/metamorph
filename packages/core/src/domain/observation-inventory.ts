import type { InventoryItem, PageSnapshotInventory } from './schemas/page-snapshot.schema.js';

export function requireObservationItems(
  inventory: PageSnapshotInventory,
): InventoryItem[] {
  const items = inventory.observationItems;
  if (!items || items.length === 0) {
    throw new Error(
      'Snapshot has no observationItems; re-run explore to capture observation inventory',
    );
  }
  return items;
}

export function findObservationItem(
  inventory: PageSnapshotInventory,
  shortId: string,
): InventoryItem | undefined {
  return inventory.observationItems?.find((item) => item.shortId === shortId);
}

export function observationLabelText(item: InventoryItem): string {
  const parts = [item.textPreview, item.ariaLabel, item.name].filter(
    (value): value is string => Boolean(value?.trim()),
  );
  return parts.join(' ').trim();
}
