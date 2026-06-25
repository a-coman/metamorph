import type { InventoryItem } from '@metamorph/core';
import { DEFAULT_MAX_A11Y_TREE_CHARS } from './capture-defaults.js';
import {
  findMatchedA11yLineIndices,
  stripPlaywrightMetadata,
} from './a11y-snapshot-lines.js';

function truncateTree(tree: string, maxChars: number): string {
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

/**
 * Structural a11y context for debugging/CLI — not sent to the LLM prompt.
 * Matched lines are omitted because they are represented in inventory.
 */
export function annotateAccessibilityTree(
  snapshot: string,
  items: InventoryItem[],
  options?: { maxChars?: number },
): string {
  if (!snapshot.trim()) return '';

  const maxChars = options?.maxChars ?? DEFAULT_MAX_A11Y_TREE_CHARS;
  const lines = snapshot.split('\n');
  const matchedLineIndices = findMatchedA11yLineIndices(snapshot, items);

  const contextLines = lines
    .filter((_, index) => !matchedLineIndices.has(index))
    .map((line) => stripPlaywrightMetadata(line))
    .filter((line) => line.trim().length > 0);

  if (contextLines.length === 0) {
    return '';
  }

  return truncateTree(contextLines.join('\n'), maxChars);
}
