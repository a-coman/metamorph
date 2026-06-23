import type { MrIntent, PageSnapshotInventory } from '@metamorph/core';

function summarizeInventory(inventory: PageSnapshotInventory): string {
  return inventory.items
    .slice(0, 80)
    .map(
      (item) =>
        `${item.shortId} role=${item.role ?? 'n/a'} tag=${item.tagName} name=${item.name ?? item.textPreview ?? 'n/a'}`,
    )
    .join('\n');
}

export function buildObservationAnchorSystemPrompt(): string {
  return [
    'You identify the DOM container that holds search/listing results for metamorphic observation.',
    'Return ONLY valid JSON matching this shape (no markdown, no extra keys):',
    '{',
    '  "container_element_id": string,',
    '  "item_selector_hint": "listitem" | "article" | "li" (optional),',
    '  "rationale": string',
    '}',
    '',
    'Rules:',
    '- container_element_id MUST be an inventory shortId (e.g. E12) from the provided list.',
    '- Pick the element that wraps the results grid or list (not header, footer, or sidebar).',
    '- item_selector_hint describes the repeated child items inside the container.',
    '- If unsure, prefer a main content list/grid container over the whole page.',
  ].join('\n');
}

export function buildObservationAnchorUserText(input: {
  url: string;
  mrIntent: MrIntent;
  inventory: PageSnapshotInventory;
}): string {
  return [
    `URL: ${input.url}`,
    `MR transformation: ${input.mrIntent.mr_definition.transformation.description}`,
    '',
    'Inventory elements (shortId → metadata):',
    summarizeInventory(input.inventory),
    '',
    'Attached: annotated screenshot at end of source phase (results visible).',
    'Identify the results container element_id for counting visible items during replay.',
  ].join('\n');
}
