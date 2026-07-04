import type { InventoryItem } from '@metamorph/core';
import { formatLocatorSegment } from './parse-locator-chain.js';

export const DEFAULT_MERGE_IOU_THRESHOLD = 0.8;

export function boxIoU(
  a: InventoryItem['boundingBox'],
  b: InventoryItem['boundingBox'],
): number {
  if (!a || !b) return 0;

  const xOverlap = Math.max(
    0,
    Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x),
  );
  const yOverlap = Math.max(
    0,
    Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y),
  );
  const intersection = xOverlap * yOverlap;
  if (intersection <= 0) return 0;

  const areaA = Math.max(1, a.width * a.height);
  const areaB = Math.max(1, b.width * b.height);
  const union = areaA + areaB - intersection;
  return intersection / union;
}

/** True when most of the DOM box lies inside the a11y box (not the reverse). */
export function domContainedInA11yBox(
  a11yBox: NonNullable<InventoryItem['boundingBox']>,
  domBox: NonNullable<InventoryItem['boundingBox']>,
  threshold = DEFAULT_MERGE_IOU_THRESHOLD,
): boolean {
  const xOverlap = Math.max(
    0,
    Math.min(a11yBox.x + a11yBox.width, domBox.x + domBox.width) -
      Math.max(a11yBox.x, domBox.x),
  );
  const yOverlap = Math.max(
    0,
    Math.min(a11yBox.y + a11yBox.height, domBox.y + domBox.height) -
      Math.max(a11yBox.y, domBox.y),
  );
  const intersection = xOverlap * yOverlap;
  if (intersection <= 0) return false;

  const domArea = Math.max(1, domBox.width * domBox.height);
  return intersection / domArea >= threshold;
}

function isStableSelector(selector: string): boolean {
  if (!selector || selector === 'html') return false;
  return selector.startsWith('#') || selector.includes('[data-testid=');
}

function preferSelector(current: string, candidate: string): string {
  if (isStableSelector(candidate) && !isStableSelector(current)) {
    return candidate;
  }
  if (candidate.length < current.length && isStableSelector(candidate)) {
    return candidate;
  }
  return current;
}

function overlapsA11yItem(
  a11yItem: InventoryItem,
  domItem: InventoryItem,
  overlapThreshold: number,
): boolean {
  if (!a11yItem.boundingBox || !domItem.boundingBox) {
    return false;
  }
  return (
    boxIoU(a11yItem.boundingBox, domItem.boundingBox) >= overlapThreshold ||
    domContainedInA11yBox(a11yItem.boundingBox, domItem.boundingBox, overlapThreshold)
  );
}

function findBestOverlappingDomItem(
  a11yItem: InventoryItem,
  domItems: InventoryItem[],
  overlapThreshold: number,
): InventoryItem | null {
  let best: InventoryItem | null = null;
  let bestIoU = 0;

  for (const domItem of domItems) {
    if (!overlapsA11yItem(a11yItem, domItem, overlapThreshold)) {
      continue;
    }
    const iou = boxIoU(a11yItem.boundingBox, domItem.boundingBox);
    if (iou > bestIoU) {
      bestIoU = iou;
      best = domItem;
    }
  }

  return best;
}

function appendCandidate(
  candidates: string[] | undefined,
  chain: string,
): string[] {
  const current = candidates ?? [];
  return current.includes(chain) ? current : [...current, chain];
}

/** Adopt stable selectors from overlapping raw DOM items before filtering supplements. */
export function enrichA11yItemsFromDomItems(
  a11yItems: InventoryItem[],
  rawDomItems: InventoryItem[],
  overlapThreshold = DEFAULT_MERGE_IOU_THRESHOLD,
): InventoryItem[] {
  return a11yItems.map((a11yItem) => {
    const domMatch = findBestOverlappingDomItem(a11yItem, rawDomItems, overlapThreshold);
    if (!domMatch) {
      return { ...a11yItem };
    }

    const nextSelector = preferSelector(a11yItem.selector, domMatch.selector);
    const adoptedDomSelector = nextSelector === domMatch.selector;
    const candidates =
      adoptedDomSelector && domMatch.selectorMatchCount === 1
        ? appendCandidate(a11yItem.candidates, formatLocatorSegment(nextSelector))
        : a11yItem.candidates;

    return {
      ...a11yItem,
      selector: nextSelector,
      selectorMatchCount: adoptedDomSelector
        ? domMatch.selectorMatchCount ?? a11yItem.selectorMatchCount
        : a11yItem.selectorMatchCount,
      id: a11yItem.id ?? domMatch.id,
      textPreview: a11yItem.textPreview ?? domMatch.textPreview ?? null,
      ...(candidates !== undefined ? { candidates } : {}),
    };
  });
}

export function filterSupplementalDomItems(
  domItems: InventoryItem[],
  a11yItems: InventoryItem[],
  overlapThreshold = DEFAULT_MERGE_IOU_THRESHOLD,
): InventoryItem[] {
  return domItems.filter((domItem) => {
    if (!domItem.boundingBox) {
      return true;
    }
    return !a11yItems.some((a11yItem) => overlapsA11yItem(a11yItem, domItem, overlapThreshold));
  });
}

export function appendSupplementalDomItems(
  a11yItems: InventoryItem[],
  supplementalDomItems: InventoryItem[],
): InventoryItem[] {
  return [
    ...a11yItems,
    ...supplementalDomItems.map((item) => ({ ...item, source: 'dom' as const })),
  ];
}

const TIER1_TAG_NAMES = new Set(['select', 'input', 'textarea', 'button']);
const TIER1_ROLES = new Set([
  'button',
  'checkbox',
  'radio',
  'combobox',
  'searchbox',
  'textbox',
]);

export function isTier1InventoryItem(item: InventoryItem): boolean {
  const tagName = item.tagName?.toLowerCase() ?? '';
  const role = item.role?.toLowerCase() ?? '';
  if (TIER1_TAG_NAMES.has(tagName)) {
    return true;
  }
  return role !== '' && TIER1_ROLES.has(role);
}

function sourceRank(item: InventoryItem): number {
  return item.source === 'a11y' ? 0 : 1;
}

function compareInventoryItemsForCap(a: InventoryItem, b: InventoryItem): number {
  const sourceDiff = sourceRank(a) - sourceRank(b);
  if (sourceDiff !== 0) {
    return sourceDiff;
  }
  return (b.score ?? 0) - (a.score ?? 0);
}

/** Apply the inventory cap once after merge; tier1 controls precede links and generic targets. */
export function capInventoryItems(
  items: InventoryItem[],
  maxItems: number,
): InventoryItem[] {
  const tier1 = items.filter(isTier1InventoryItem).sort(compareInventoryItemsForCap);
  const tier2 = items
    .filter((item) => !isTier1InventoryItem(item))
    .sort(compareInventoryItemsForCap);

  const ordered = [...tier1, ...tier2];
  if (!Number.isFinite(maxItems) || ordered.length <= maxItems) {
    return ordered;
  }

  return ordered.slice(0, maxItems);
}

export function assignInventoryShortIds(items: InventoryItem[]): InventoryItem[] {
  return items.map((item, index) => ({
    ...item,
    index,
    shortId: `E${index + 1}`,
    labelShown: false,
  }));
}
