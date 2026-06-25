import type { SlotStep } from '../../domain/schemas/generation-slots.schema.js';
import type { InventoryItem, PageSnapshotInventory } from '../../domain/schemas/page-snapshot.schema.js';

export type SelectOptionValidationError = {
  stepId: number;
  elementId: string;
  message: string;
};

function isSelectOptionTarget(item: InventoryItem): boolean {
  if (item.tagName === 'select') {
    return true;
  }

  return item.role?.toLowerCase() === 'combobox';
}

export function validateSelectOptionSteps(
  steps: SlotStep[],
  inventory: PageSnapshotInventory,
): SelectOptionValidationError[] {
  const itemMap = new Map(inventory.items.map((item) => [item.shortId, item]));
  const errors: SelectOptionValidationError[] = [];

  for (const step of steps) {
    if (step.action !== 'selectOption' || !step.element_id) {
      continue;
    }

    const item = itemMap.get(step.element_id);
    if (!item) {
      continue;
    }

    if (!isSelectOptionTarget(item)) {
      errors.push({
        stepId: step.id,
        elementId: step.element_id,
        message:
          `selectOption not allowed on ${step.element_id} (${item.tagName}` +
          `${item.role ? ` role=${item.role}` : ''}) — use click or pick a select/combobox item`,
      });
      continue;
    }

    const options = item.options ?? [];
    if (options.length === 0) {
      errors.push({
        stepId: step.id,
        elementId: step.element_id,
        message:
          `selectOption on ${step.element_id} has no options in inventory — use click instead`,
      });
      continue;
    }

    const value = step.value ?? '';
    if (!options.some((option) => option.value === value)) {
      const allowed = options.map((option) => option.value).join(', ');
      errors.push({
        stepId: step.id,
        elementId: step.element_id,
        message:
          `selectOption value=${JSON.stringify(value)} on ${step.element_id} not in options — allowed: ${allowed}`,
      });
    }
  }

  return errors;
}

export function formatSelectOptionValidationErrors(
  errors: SelectOptionValidationError[],
): string {
  return errors.map((error) => error.message).join('; ');
}
