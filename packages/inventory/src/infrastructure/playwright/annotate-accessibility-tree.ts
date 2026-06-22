import type { InventoryItem } from '@metamorph/core';
import { DEFAULT_MAX_A11Y_TREE_CHARS } from './capture-defaults.js';

type ParsedA11yLine = {
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
};

const MATCH_SCORE_THRESHOLD = 50;

function normalizeText(value: string | null | undefined): string {
  return (value ?? '').trim().toLowerCase().replace(/\s+/g, ' ');
}

function inventoryRoles(item: InventoryItem): Set<string> {
  const roles = new Set<string>();
  if (item.role) {
    roles.add(normalizeText(item.role));
  }

  const tag = normalizeText(item.tagName);
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

  const normalized = normalizeText(role);
  roles.add(normalized);
  for (const [canonical, aliases] of Object.entries(ROLE_ALIASES)) {
    if (aliases.includes(normalized)) {
      roles.add(canonical);
    }
  }
  return roles;
}

function inventoryAccessibleName(item: InventoryItem): string {
  return normalizeText(item.name || item.ariaLabel || item.textPreview);
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

function parseA11yLine(line: string, lineIndex: number): ParsedA11yLine | null {
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

  const normalizedLine = normalizeText(lineName);
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

function scoreMatch(item: InventoryItem, line: ParsedA11yLine): number {
  const roleScore = roleMatchScore(item, line);
  const nameScore = nameMatchScore(inventoryAccessibleName(item), line.name);
  const boxScore = boxOverlapScore(item.boundingBox, line.box);

  if (nameScore === 0 && roleScore === 0 && boxScore === 0) {
    return 0;
  }

  return roleScore + nameScore + boxScore;
}

function truncateAnnotatedTree(tree: string, maxChars: number): string {
  if (tree.length <= maxChars) return tree;

  const lines = tree.split('\n');
  const kept: string[] = [];
  let length = 0;
  let omitted = 0;

  for (const line of lines) {
    const nextLength = length + line.length + 1;
    if (nextLength > maxChars) {
      omitted += 1;
      continue;
    }
    kept.push(line);
    length = nextLength;
  }

  if (omitted > 0) {
    kept.push(`… (tree truncated, ${omitted} lines omitted)`);
  }

  return kept.join('\n');
}

export function annotateAccessibilityTree(
  snapshot: string,
  items: InventoryItem[],
  options?: { maxChars?: number },
): string {
  if (!snapshot.trim()) return '';

  const maxChars = options?.maxChars ?? DEFAULT_MAX_A11Y_TREE_CHARS;
  const lines = snapshot.split('\n');
  const parsedLines = lines
    .map((line, index) => parseA11yLine(line, index))
    .filter((line): line is ParsedA11yLine => line !== null);

  const candidates: Array<{ item: InventoryItem; line: ParsedA11yLine; score: number }> =
    [];

  for (const item of items) {
    for (const line of parsedLines) {
      const score = scoreMatch(item, line);
      if (score >= MATCH_SCORE_THRESHOLD) {
        candidates.push({ item, line, score });
      }
    }
  }

  candidates.sort((a, b) => b.score - a.score);

  const assignedLines = new Set<number>();
  const assignedItems = new Set<string>();
  const lineAnnotations = new Map<number, string>();

  for (const candidate of candidates) {
    if (assignedLines.has(candidate.line.lineIndex)) continue;
    if (assignedItems.has(candidate.item.shortId)) continue;

    assignedLines.add(candidate.line.lineIndex);
    assignedItems.add(candidate.item.shortId);
    lineAnnotations.set(candidate.line.lineIndex, candidate.item.shortId);
  }

  const annotated = lines
    .map((line, index) => {
      const shortId = lineAnnotations.get(index);
      return shortId ? `${line} → ${shortId}` : line;
    })
    .join('\n');

  return truncateAnnotatedTree(annotated, maxChars);
}
