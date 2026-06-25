import type { InventoryItem } from '@metamorph/core';

export type ParsedA11yLine = {
  lineIndex: number;
  indent: number;
  role: string | null;
  name: string | null;
  rawLine: string;
  box: { x: number; y: number; width: number; height: number } | null;
};

const ROLE_ALIASES: Record<string, string[]> = {
  link: ['link', 'a'],
  button: ['button'],
  textbox: ['textbox', 'textarea', 'input'],
  searchbox: ['searchbox', 'textbox', 'input'],
  combobox: ['combobox', 'select'],
  checkbox: ['checkbox', 'input'],
  dialog: ['dialog'],
  listbox: ['listbox'],
  option: ['option', 'listitem'],
  heading: ['heading'],
  img: ['img', 'image'],
  navigation: ['navigation', 'nav'],
  menuitem: ['menuitem'],
  tab: ['tab'],
  radio: ['radio'],
  switch: ['switch'],
};

/** Roles eligible for promotion into inventory when unmatched by DOM scan. */
export const PROMOTABLE_A11Y_ROLES = new Set([
  'button',
  'link',
  'checkbox',
  'radio',
  'searchbox',
  'combobox',
  'textbox',
  'option',
  'menuitem',
  'tab',
  'switch',
]);

const WEAK_MATCH_ROLES = new Set(['generic', 'group', 'none', 'presentation', 'region']);

export const A11Y_INVENTORY_MATCH_SCORE_THRESHOLD = 50;

export function normalizeA11yText(value: string | null | undefined): string {
  return (value ?? '').trim().toLowerCase().replace(/\s+/g, ' ');
}

function inventoryRoles(item: InventoryItem): Set<string> {
  const roles = new Set<string>();
  if (item.role) {
    roles.add(normalizeA11yText(item.role));
  }

  const tag = normalizeA11yText(item.tagName);
  if (tag === 'a') roles.add('link');
  if (tag === 'button') roles.add('button');
  if (tag === 'textarea') roles.add('textbox');
  if (tag === 'select') roles.add('combobox');
  if (tag === 'input') {
    roles.add('textbox');
    roles.add('searchbox');
  }

  for (const [canonical, aliases] of Object.entries(ROLE_ALIASES)) {
    if (aliases.some((alias) => roles.has(alias))) {
      roles.add(canonical);
    }
  }

  return roles;
}

function lineRoles(role: string | null): Set<string> {
  const roles = new Set<string>();
  if (!role) return roles;

  const normalized = normalizeA11yText(role);
  roles.add(normalized);
  for (const [canonical, aliases] of Object.entries(ROLE_ALIASES)) {
    if (aliases.includes(normalized)) {
      roles.add(canonical);
    }
  }
  return roles;
}

function inventoryAccessibleName(item: InventoryItem): string {
  return normalizeA11yText(item.name || item.ariaLabel || item.textPreview);
}

function parseBoxSuffix(suffix: string): ParsedA11yLine['box'] {
  const match = suffix.match(/\[box=([-\d.]+),([-\d.]+),([-\d.]+),([-\d.]+)\]/);
  if (!match) return null;

  return {
    x: Number(match[1]),
    y: Number(match[2]),
    width: Number(match[3]),
    height: Number(match[4]),
  };
}

export function parseA11yLine(line: string, lineIndex: number): ParsedA11yLine | null {
  const match = line.match(/^(\s*)-\s+(.+)$/);
  if (!match) return null;

  const indent = match[1]!.length;
  let content = match[2]!.trim();
  const box = parseBoxSuffix(content);
  content = content.replace(/\s*\[box=[^\]]+\]/g, '').replace(/\s*\[ref=[^\]]+\]/g, '').trim();

  const textMatch = content.match(/^text:\s*(.+)$/i);
  if (textMatch) {
    return {
      lineIndex,
      indent,
      role: 'text',
      name: textMatch[1]!.trim(),
      rawLine: line,
      box,
    };
  }

  const roleNameMatch = content.match(/^([\w-]+)\s+"([^"]*)"(.*)$/);
  if (roleNameMatch) {
    return {
      lineIndex,
      indent,
      role: roleNameMatch[1]!,
      name: roleNameMatch[2]!,
      rawLine: line,
      box,
    };
  }

  const roleOnlyMatch = content.match(/^([\w-]+)(?::\s*(.+))?$/);
  if (roleOnlyMatch) {
    return {
      lineIndex,
      indent,
      role: roleOnlyMatch[1]!,
      name: roleOnlyMatch[2]?.trim() ?? null,
      rawLine: line,
      box,
    };
  }

  return {
    lineIndex,
    indent,
    role: null,
    name: content,
    rawLine: line,
    box,
  };
}

export function parseA11ySnapshot(snapshot: string): ParsedA11yLine[] {
  return snapshot
    .split('\n')
    .map((line, index) => parseA11yLine(line, index))
    .filter((line): line is ParsedA11yLine => line !== null);
}

function boxOverlapScore(
  itemBox: InventoryItem['boundingBox'],
  lineBox: ParsedA11yLine['box'],
): number {
  if (!itemBox || !lineBox) return 0;

  const xOverlap = Math.max(
    0,
    Math.min(itemBox.x + itemBox.width, lineBox.x + lineBox.width) -
      Math.max(itemBox.x, lineBox.x),
  );
  const yOverlap = Math.max(
    0,
    Math.min(itemBox.y + itemBox.height, lineBox.y + lineBox.height) -
      Math.max(itemBox.y, lineBox.y),
  );
  const overlapArea = xOverlap * yOverlap;
  if (overlapArea <= 0) return 0;

  const itemArea = Math.max(1, itemBox.width * itemBox.height);
  const ratio = overlapArea / itemArea;
  if (ratio >= 0.5) return 80;
  if (ratio >= 0.25) return 50;
  return 20;
}

function nameMatchScore(itemName: string, lineName: string | null): number {
  if (!itemName || !lineName) return 0;

  const normalizedLine = normalizeA11yText(lineName);
  if (!normalizedLine) return 0;

  if (itemName === normalizedLine) return 50;
  if (itemName.includes(normalizedLine) || normalizedLine.includes(itemName)) return 30;

  const itemTokens = itemName.split(' ').filter(Boolean);
  const lineTokens = normalizedLine.split(' ').filter(Boolean);
  const shared = itemTokens.filter((token) => lineTokens.includes(token)).length;
  if (shared > 0 && itemTokens.length > 0) {
    return Math.round((shared / itemTokens.length) * 20);
  }

  return 0;
}

function roleMatchScore(item: InventoryItem, line: ParsedA11yLine): number {
  const itemRoleSet = inventoryRoles(item);
  const lineRoleSet = lineRoles(line.role);
  if (itemRoleSet.size === 0 || lineRoleSet.size === 0) return 0;

  for (const role of itemRoleSet) {
    if (lineRoleSet.has(role)) return 40;
  }
  return 0;
}

function isWeakRoleLine(line: ParsedA11yLine): boolean {
  if (!line.role) return true;
  return WEAK_MATCH_ROLES.has(normalizeA11yText(line.role));
}

export function scoreA11yLineAgainstItem(item: InventoryItem, line: ParsedA11yLine): number {
  const roleScore = roleMatchScore(item, line);
  const nameScore = nameMatchScore(inventoryAccessibleName(item), line.name);
  const boxScore = boxOverlapScore(item.boundingBox, line.box);

  if (nameScore === 0 && roleScore === 0 && boxScore === 0) {
    return 0;
  }

  if (isWeakRoleLine(line)) {
    if (nameScore === 0) {
      return 0;
    }
    if (boxScore < 50) {
      return 0;
    }
  }

  return roleScore + nameScore + boxScore;
}

export function findMatchedA11yLineIndices(
  snapshot: string,
  items: InventoryItem[],
): Set<number> {
  const parsedLines = parseA11ySnapshot(snapshot);
  const candidates: Array<{ item: InventoryItem; line: ParsedA11yLine; score: number }> =
    [];

  for (const item of items) {
    for (const line of parsedLines) {
      const score = scoreA11yLineAgainstItem(item, line);
      if (score >= A11Y_INVENTORY_MATCH_SCORE_THRESHOLD) {
        candidates.push({ item, line, score });
      }
    }
  }

  candidates.sort((a, b) => b.score - a.score);

  const matchedLineIndices = new Set<number>();
  const assignedItems = new Set<string>();

  for (const candidate of candidates) {
    if (matchedLineIndices.has(candidate.line.lineIndex)) continue;
    if (assignedItems.has(candidate.item.shortId)) continue;

    matchedLineIndices.add(candidate.line.lineIndex);
    assignedItems.add(candidate.item.shortId);
  }

  return matchedLineIndices;
}

const CHOICE_ENRICHMENT_ROLES = new Set(['checkbox', 'radio']);
const INTERACTIVE_ENRICHMENT_ROLES = new Set(['link', 'button', 'checkbox', 'radio']);

export const A11Y_ENRICHMENT_BOX_OVERLAP_THRESHOLD = 0.5;

export function boxOverlapRatio(
  itemBox: InventoryItem['boundingBox'],
  lineBox: ParsedA11yLine['box'],
): number {
  if (!itemBox || !lineBox) return 0;

  const xOverlap = Math.max(
    0,
    Math.min(itemBox.x + itemBox.width, lineBox.x + lineBox.width) -
      Math.max(itemBox.x, lineBox.x),
  );
  const yOverlap = Math.max(
    0,
    Math.min(itemBox.y + itemBox.height, lineBox.y + lineBox.height) -
      Math.max(itemBox.y, lineBox.y),
  );
  const overlapArea = xOverlap * yOverlap;
  if (overlapArea <= 0) return 0;

  const itemArea = Math.max(1, itemBox.width * itemBox.height);
  return overlapArea / itemArea;
}

export function rolesCompatibleForEnrichment(
  item: InventoryItem,
  line: ParsedA11yLine,
): boolean {
  const itemRoleSet = inventoryRoles(item);
  const lineRoleSet = lineRoles(line.role);

  for (const role of itemRoleSet) {
    if (lineRoleSet.has(role)) {
      return true;
    }
  }

  const lineRole = canonicalA11yRole(line.role);
  if (!lineRole) {
    return false;
  }

  if (CHOICE_ENRICHMENT_ROLES.has(lineRole)) {
    for (const role of itemRoleSet) {
      if (INTERACTIVE_ENRICHMENT_ROLES.has(role)) {
        return true;
      }
    }
  }

  return false;
}

export function findDomItemForEnrichment(
  domItems: InventoryItem[],
  line: ParsedA11yLine,
): number | null {
  if (!line.box) {
    return null;
  }

  let bestIndex: number | null = null;
  let bestOverlap = 0;

  for (let index = 0; index < domItems.length; index += 1) {
    const item = domItems[index]!;
    if (!rolesCompatibleForEnrichment(item, line)) {
      continue;
    }

    const overlap = boxOverlapRatio(item.boundingBox, line.box);
    if (
      overlap >= A11Y_ENRICHMENT_BOX_OVERLAP_THRESHOLD &&
      overlap > bestOverlap
    ) {
      bestOverlap = overlap;
      bestIndex = index;
    }
  }

  return bestIndex;
}

export function canonicalA11yRole(role: string | null): string | null {
  if (!role) return null;
  const normalized = normalizeA11yText(role);
  for (const [canonical, aliases] of Object.entries(ROLE_ALIASES)) {
    if (canonical === normalized || aliases.includes(normalized)) {
      return canonical;
    }
  }
  return normalized;
}

export function isPromotableA11yLine(line: ParsedA11yLine): boolean {
  const role = canonicalA11yRole(line.role);
  if (!role || !PROMOTABLE_A11Y_ROLES.has(role)) {
    return false;
  }

  const name = line.name?.trim();
  return Boolean(name);
}

export function tagNameForA11yRole(role: string): string {
  switch (role) {
    case 'link':
      return 'a';
    case 'button':
      return 'button';
    case 'combobox':
      return 'select';
    case 'checkbox':
    case 'searchbox':
    case 'textbox':
    case 'radio':
    case 'switch':
      return 'input';
    case 'option':
    case 'menuitem':
    case 'tab':
      return 'div';
    default:
      return 'div';
  }
}

export function buildA11yLocator(line: ParsedA11yLine): string | null {
  const role = canonicalA11yRole(line.role);
  const name = line.name?.trim();
  if (!role || !name) {
    return null;
  }

  return `getByRole(${JSON.stringify(role)}, { name: ${JSON.stringify(name)} })`;
}

export function stripPlaywrightMetadata(line: string): string {
  const match = line.match(/^(\s*)-\s+(.+)$/);
  if (!match) return line;

  const indent = match[1]!;
  const cleaned = match[2]!
    .replace(/\s*\[box=[^\]]+\]/g, '')
    .replace(/\s*\[ref=[^\]]+\]/g, '')
    .replace(/\s*\[cursor=pointer\]/g, '')
    .trim();

  return `${indent}- ${cleaned}`;
}
