import type { InventoryItem } from '@metamorph/core';
import type { Page } from 'playwright';
import {
  buildA11yLocator,
  canonicalA11yRole,
  findDomItemForEnrichment,
  findMatchedA11yLineIndices,
  isPromotableA11yLine,
  parseA11ySnapshot,
  tagNameForA11yRole,
  type ParsedA11yLine,
} from './a11y-snapshot-lines.js';
import { countLocatorMatches } from './count-locator-matches.js';
import { resolveShortDisplayName } from './resolve-display-name.js';

/** Default cap on a11y-only promotions when maxItems is unbounded. */
export const DEFAULT_MAX_A11Y_PROMOTIONS = 200;

const A11Y_PROMOTION_ROLE_PRIORITY: Record<string, number> = {
  checkbox: 100,
  radio: 95,
  link: 80,
  button: 75,
  menuitem: 70,
  tab: 65,
  searchbox: 60,
  combobox: 55,
  textbox: 50,
  switch: 45,
  option: 10,
};

function promotionPriority(line: ParsedA11yLine): number {
  const role = canonicalA11yRole(line.role);
  return role ? (A11Y_PROMOTION_ROLE_PRIORITY[role] ?? 40) : 0;
}

const A11Y_PROMOTED_SCORE = 45;
const A11Y_PLACEHOLDER_SELECTOR = 'html';

export type PromoteA11yInventoryOptions = {
  maxPromotions?: number;
};

export type PromoteA11yInventoryResult = {
  enrichedDom: InventoryItem[];
  promoted: InventoryItem[];
};

function collectUsedLocators(items: InventoryItem[]): Set<string> {
  const used = new Set<string>();
  for (const item of items) {
    if (item.locator) {
      used.add(item.locator);
    }
  }
  return used;
}

function boundingBoxFromLine(
  line: ParsedA11yLine,
): InventoryItem['boundingBox'] | undefined {
  if (!line.box) return undefined;
  return {
    x: line.box.x,
    y: line.box.y,
    width: line.box.width,
    height: line.box.height,
  };
}

function enrichDomItemFromA11yLine(
  item: InventoryItem,
  line: ParsedA11yLine,
  locator: string,
): void {
  const lineRole = canonicalA11yRole(line.role);
  if (lineRole === 'checkbox' || lineRole === 'radio') {
    item.role = lineRole;
  }

  const fullName = line.name?.trim() ?? '';
  const shortName = resolveShortDisplayName(fullName, item.textPreview);
  item.name = shortName;
  item.textPreview = shortName;
  if (fullName) {
    item.ariaLabel = fullName;
  }
  item.locator = locator;
}

function buildPromotedItem(
  line: ParsedA11yLine,
  index: number,
  shortId: string,
  locator: string,
  locatorMatchCount: number,
): InventoryItem {
  const role = canonicalA11yRole(line.role)!;
  const fullName = line.name!.trim();
  const shortName = resolveShortDisplayName(fullName);

  return {
    index,
    shortId,
    locator,
    selector: A11Y_PLACEHOLDER_SELECTOR,
    score: A11Y_PROMOTED_SCORE,
    labelShown: false,
    tagName: tagNameForA11yRole(role),
    id: null,
    role,
    name: shortName,
    ariaLabel: fullName,
    textPreview: shortName,
    locatorMatchCount,
    selectorMatchCount: 0,
    boundingBox: boundingBoxFromLine(line),
  };
}

export function listA11yPromotionCandidates(
  snapshot: string,
  domItems: InventoryItem[],
): ParsedA11yLine[] {
  if (!snapshot.trim()) {
    return [];
  }

  const matchedLineIndices = findMatchedA11yLineIndices(snapshot, domItems);
  return parseA11ySnapshot(snapshot)
    .filter(
      (line) => !matchedLineIndices.has(line.lineIndex) && isPromotableA11yLine(line),
    )
    .sort((a, b) => promotionPriority(b) - promotionPriority(a));
}

export async function promoteA11yInventoryItems(
  page: Page,
  snapshot: string,
  domItems: InventoryItem[],
  options: PromoteA11yInventoryOptions = {},
): Promise<PromoteA11yInventoryResult> {
  const maxPromotions = options.maxPromotions ?? DEFAULT_MAX_A11Y_PROMOTIONS;
  if (!snapshot.trim()) {
    return { enrichedDom: domItems.map((item) => ({ ...item })), promoted: [] };
  }

  const enrichedDom = domItems.map((item) => ({ ...item }));
  const usedLocators = collectUsedLocators(enrichedDom);
  const candidates = listA11yPromotionCandidates(snapshot, domItems);
  const promoted: InventoryItem[] = [];

  for (const line of candidates) {
    const locator = buildA11yLocator(line);
    if (!locator || usedLocators.has(locator)) {
      continue;
    }

    const locatorMatchCount = await countLocatorMatches(page, locator);
    if (locatorMatchCount !== 1) {
      continue;
    }

    const enrichIndex = findDomItemForEnrichment(enrichedDom, line);
    if (enrichIndex !== null) {
      enrichDomItemFromA11yLine(enrichedDom[enrichIndex]!, line, locator);
      usedLocators.add(locator);
      continue;
    }

    if (promoted.length >= maxPromotions) {
      break;
    }

    const shortId = `E${enrichedDom.length + promoted.length + 1}`;
    promoted.push(
      buildPromotedItem(
        line,
        enrichedDom.length + promoted.length,
        shortId,
        locator,
        locatorMatchCount,
      ),
    );
    usedLocators.add(locator);
  }

  return { enrichedDom, promoted };
}

export function mergeDomAndPromotedInventory(
  domItems: InventoryItem[],
  promotedItems: InventoryItem[],
): InventoryItem[] {
  if (promotedItems.length === 0) {
    return domItems;
  }

  return [...domItems, ...promotedItems];
}
