import type { SlotStep } from '../../domain/schemas/generation-slots.schema.js';
import type { InventoryItem } from '../../domain/schemas/page-snapshot.schema.js';
import { PlaybookCompileError } from './playbook-compiler.js';

export type ResolvedInventoryTarget =
  | { kind: 'locator'; value: string }
  | { kind: 'selector'; value: string };

function hasMatchCountMetadata(item: InventoryItem): boolean {
  return (
    item.locatorMatchCount !== undefined || item.selectorMatchCount !== undefined
  );
}

export function resolveInventoryItemTarget(
  item: InventoryItem,
): ResolvedInventoryTarget {
  if (hasMatchCountMetadata(item)) {
    if (item.locator && item.locatorMatchCount === 1) {
      return { kind: 'locator', value: item.locator };
    }

    if (item.selectorMatchCount === 1) {
      return { kind: 'selector', value: item.selector };
    }

    throw new PlaybookCompileError(
      `Ambiguous target for ${item.shortId}: locator matches ${item.locatorMatchCount ?? 'n/a'}, selector matches ${item.selectorMatchCount ?? 'n/a'}`,
    );
  }

  if (item.locator) {
    return { kind: 'locator', value: item.locator };
  }

  return { kind: 'selector', value: item.selector };
}

export function applyResolvedTargetToStep(
  step: SlotStep,
  target: ResolvedInventoryTarget,
): SlotStep {
  if (target.kind === 'locator') {
    return {
      ...step,
      resolved_locator: target.value,
      resolved_selector: undefined,
    };
  }

  return {
    ...step,
    resolved_selector: target.value,
    resolved_locator: undefined,
  };
}

export function renderTargetExpression(target: ResolvedInventoryTarget): string {
  if (target.kind === 'locator') {
    return `page.${target.value}`;
  }

  return `page.locator(${JSON.stringify(target.value)})`;
}

export function resolveStepTargetExpression(
  step: SlotStep,
  itemMap: Map<string, InventoryItem>,
): string {
  if (step.resolved_locator) {
    return `page.${step.resolved_locator}`;
  }

  if (step.resolved_selector) {
    return `page.locator(${JSON.stringify(step.resolved_selector)})`;
  }

  if (!step.element_id) {
    throw new PlaybookCompileError(
      `Step ${step.id}: ${step.action} requires element_id`,
    );
  }

  const item = itemMap.get(step.element_id);
  if (!item) {
    throw new PlaybookCompileError(
      `element_id ${step.element_id} not found in inventory`,
    );
  }

  return renderTargetExpression(resolveInventoryItemTarget(item));
}
