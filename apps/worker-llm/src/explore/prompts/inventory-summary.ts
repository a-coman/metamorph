import { isFillableInventoryItem, type PageSnapshotInventory } from '@metamorph/core';

export function buildInventorySummary(inventory: PageSnapshotInventory): string {
  return inventory.items
    .map((item) => {
      const parts = [
        item.shortId,
        item.tagName,
        isFillableInventoryItem(item) ? 'fillable' : null,
        item.role ? `role=${item.role}` : null,
        item.name ? `name=${JSON.stringify(item.name)}` : null,
        item.ariaLabel ? `aria=${JSON.stringify(item.ariaLabel)}` : null,
        item.textPreview ? `text=${JSON.stringify(item.textPreview.slice(0, 60))}` : null,
      ].filter(Boolean);

      return `- ${parts.join(' | ')}`;
    })
    .join('\n');
}
