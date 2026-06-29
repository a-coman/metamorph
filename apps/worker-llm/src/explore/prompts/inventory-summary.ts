import { isFillableInventoryItem, type PageSnapshotInventory, type InventoryItem, DEFAULT_MAX_A11Y_TREE_CHARS } from '@metamorph/core';

const MAX_OPTION_LABEL_CHARS = 40;
const MAX_OPTIONS_IN_PROMPT = 8;

function formatSelectOptions(
  options: NonNullable<PageSnapshotInventory['items'][number]['options']>,
): string {
  const formatted = options.map((option) => {
    const label =
      option.label.length > MAX_OPTION_LABEL_CHARS
        ? `${option.label.slice(0, MAX_OPTION_LABEL_CHARS - 3)}...`
        : option.label;
    return `{value:${JSON.stringify(option.value)},label:${JSON.stringify(label)}}`;
  });

  if (formatted.length <= MAX_OPTIONS_IN_PROMPT) {
    return `options=[${formatted.join(',')}]`;
  }

  const shown = formatted.slice(0, MAX_OPTIONS_IN_PROMPT);
  const allValues = options.map((option) => JSON.stringify(option.value)).join(',');
  return `options=[${shown.join(',')},...] values=[${allValues}]`;
}

export function buildInventoryItemsSummary(items: InventoryItem[]): string {
  return items
    .map((item) => {
      const parts = [
        item.shortId,
        item.tagName,
        isFillableInventoryItem(item) ? 'fillable' : null,
        item.role ? `role=${item.role}` : null,
        item.name ? `name=${JSON.stringify(item.name)}` : null,
        item.ariaLabel ? `aria=${JSON.stringify(item.ariaLabel)}` : null,
        item.textPreview ? `text=${JSON.stringify(item.textPreview.slice(0, 60))}` : null,
        item.options && item.options.length > 0 ? formatSelectOptions(item.options) : null,
      ].filter(Boolean);

      return `- ${parts.join(' | ')}`;
    })
    .join('\n');
}

export function buildInventorySummary(inventory: PageSnapshotInventory): string {
  return buildInventoryItemsSummary(inventory.items);
}

/** @deprecated Tree is no longer sent to the LLM; kept for callers that truncate stored debug trees. */
export function truncateAccessibilityTreeForPrompt(tree: string, maxChars: number): string {
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

export function buildEnrichedInventorySection(inventory: PageSnapshotInventory): string {
  return [
    'Current inventory (concrete UI instances for this snapshot — use ONLY these element_ids in steps):',
    buildInventorySummary(inventory),
  ].join('\n');
}

// Preserve export used by tests / legacy imports
export { DEFAULT_MAX_A11Y_TREE_CHARS };
