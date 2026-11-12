import type { InventoryItem, SlotStep } from '@metamorph/core';
import { ABORT_RATIONALE } from './jev-plan-explore.constants.js';

type AbortReason = keyof typeof ABORT_RATIONALE;

export function itemDisplayName(item: InventoryItem): string {
  return item.name || item.ariaLabel || item.textPreview || item.shortId;
}

export function itemRoleLabel(item: InventoryItem): string {
  return item.role || item.tagName;
}

export function synthesizeStepRationale(
  step: SlotStep,
  inventoryById: Map<string, InventoryItem>,
): string {
  const target = step.element_id ? inventoryById.get(step.element_id) : undefined;
  const role = target ? itemRoleLabel(target) : undefined;
  const name = target ? itemDisplayName(target) : step.element_id;

  switch (step.action) {
    case 'click':
      return target
        ? `click ${role} ${JSON.stringify(name)}`
        : `click ${step.element_id ?? 'unknown'}`;
    case 'fill':
      return target
        ? `fill ${role} ${JSON.stringify(name)} with ${JSON.stringify(step.value ?? '')}`
        : `fill ${step.element_id ?? 'unknown'} with ${JSON.stringify(step.value ?? '')}`;
    case 'selectOption':
      return target
        ? `selectOption ${role} ${JSON.stringify(name)} value ${JSON.stringify(step.value ?? '')}`
        : `selectOption ${step.element_id ?? 'unknown'} value ${JSON.stringify(step.value ?? '')}`;
    case 'press': {
      const key = step.key ?? 'Enter';
      if (!target) {
        return `press ${key}`;
      }
      return `press ${key} on ${role} ${JSON.stringify(name)}`;
    }
    case 'scroll': {
      const amount = step.scroll_y ?? 0;
      const direction = amount >= 0 ? 'down' : 'up';
      return `scroll ${direction} ${Math.abs(amount)}px`;
    }
    case 'waitFor':
      return `wait ${step.timeout_ms ?? 400}ms`;
    case 'goto':
      return `goto ${step.url ?? ''}`.trim();
    default:
      return step.action;
  }
}

export function synthesizePlanRationale(input: {
  action: 'append_steps' | 'scenario_complete' | 'abort';
  abortReason?: string;
  steps?: SlotStep[];
  inventoryById: Map<string, InventoryItem>;
}): string {
  if (input.action === 'abort') {
    const reason = input.abortReason;
    if (reason && reason in ABORT_RATIONALE) {
      return ABORT_RATIONALE[reason as AbortReason];
    }
    return ABORT_RATIONALE.other;
  }

  if (input.action === 'scenario_complete') {
    return 'Phase goal is already satisfied.';
  }

  const steps = input.steps ?? [];
  if (steps.length === 0) {
    return 'Append the next exploration step.';
  }

  return steps
    .map((step) => synthesizeStepRationale(step, input.inventoryById))
    .join(', then ');
}
