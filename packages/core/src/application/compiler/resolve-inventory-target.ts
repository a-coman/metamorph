import type { SlotStep } from '../../domain/schemas/generation-slots.schema.js';
import type { InventoryItem } from '../../domain/schemas/page-snapshot.schema.js';
import { PlaybookCompileError } from './playbook-compiler.js';

export type ResolvedInventoryTarget =
  | { kind: 'locator'; value: string }
  | { kind: 'selector'; value: string };

/** selector "#x" and chain locator("#x") resolve identically, so they share a dedupe key. */
function candidateKey(target: ResolvedInventoryTarget): string {
  return target.kind === 'selector'
    ? `locator(${JSON.stringify(target.value)})`
    : target.value;
}

/**
 * Ordered target candidates for an inventory item, best first. Scan-time
 * verified candidates come before legacy locator/selector fields; unverified
 * targets are included last so the probe can still attempt them and verify
 * uniqueness at runtime instead of failing at compile time.
 */
export function resolveInventoryItemTargetCandidates(
  item: InventoryItem,
): ResolvedInventoryTarget[] {
  const candidates: ResolvedInventoryTarget[] = [];
  const seen = new Set<string>();

  const push = (target: ResolvedInventoryTarget) => {
    const key = candidateKey(target);
    if (!seen.has(key)) {
      seen.add(key);
      candidates.push(target);
    }
  };

  for (const chain of item.candidates ?? []) {
    push({ kind: 'locator', value: chain });
  }

  if (item.locator && item.locatorMatchCount === 1) {
    push({ kind: 'locator', value: item.locator });
  }
  if (item.selector && item.selectorMatchCount === 1) {
    push({ kind: 'selector', value: item.selector });
  }

  if (candidates.length === 0) {
    if (item.locator) {
      push({ kind: 'locator', value: item.locator });
    }
    if (item.selector) {
      push({ kind: 'selector', value: item.selector });
    }
  }

  return candidates;
}

export function resolveInventoryItemTarget(
  item: InventoryItem,
): ResolvedInventoryTarget {
  const [best] = resolveInventoryItemTargetCandidates(item);
  if (!best) {
    throw new PlaybookCompileError(
      `No target for ${item.shortId}: locator, selector, and candidates are all missing`,
    );
  }
  return best;
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
