import type { SlotStep } from '../../domain/schemas/generation-slots.schema.js';
import type { PageSnapshotInventory } from '../../domain/schemas/page-snapshot.schema.js';

const PLAN_TARGET_ACTIONS = new Set(['click', 'fill', 'selectOption']);

/**
 * Validates element_ids in a freshly planned batch against the current snapshot
 * inventory. Committed steps from earlier snapshots are out of scope.
 */
export function validatePlanBatch(
  steps: SlotStep[],
  inventory: PageSnapshotInventory,
): string[] {
  const itemIds = new Set(inventory.items.map((item) => item.shortId));
  const missing: string[] = [];

  for (const step of steps) {
    if (step.resolved_locator || step.resolved_selector) {
      continue;
    }

    if (!step.element_id || !PLAN_TARGET_ACTIONS.has(step.action)) {
      continue;
    }

    if (!itemIds.has(step.element_id) && !missing.includes(step.element_id)) {
      missing.push(step.element_id);
    }
  }

  return missing;
}
