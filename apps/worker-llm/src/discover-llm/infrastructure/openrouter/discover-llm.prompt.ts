import type { PageSnapshotInventory } from '@metamorph/core';

export function buildDiscoverLlmSystemPrompt(): string {
  return [
    'You propose metamorphic testing relations for web applications.',
    'Return ONLY valid JSON matching this shape:',
    '{',
    '  "mr_definition": {',
    '    "precondition": { "description": string },',
    '    "transformation": { "transform_family": "idempotence", "description": string },',
    '    "relation": { "type": "equal"|"set_equal"|"subset"|"superset"|"cardinality_lte"|"cardinality_gte"|"monotone_decrease"|"monotone_increase", "on": string[], "description": string }',
    '  },',
    '  "generation_slots": {',
    '    "source": { "steps": [{ "id": number, "action": "goto"|"click"|"fill"|"selectOption"|"press"|"scroll"|"waitFor", "element_id"?: "E01", "value"?: string, "url"?: string, "key"?: string, "scroll_y"?: number, "timeout_ms"?: number }] },',
    '    "follow_up": { "steps": [...] },',
    '    "observation": { "fields": string[] }',
    '  }',
    '}',
    '',
    'Rules:',
    '- MVP vertical: idempotence of filter/search. Apply a filter in source, repeat the same action in follow_up.',
    '- Use ONLY element_id values present in the provided inventory (E01, E02, ...).',
    '- source and follow_up must each include at least one goto step and the filter action steps.',
    '- relation.on must list observation fields compared between source and follow_up.',
    '- Allowed actions: goto, click, fill, selectOption, press, scroll, waitFor.',
  ].join('\n');
}

export function buildInventorySummary(inventory: PageSnapshotInventory): string {
  return inventory.items
    .map((item) => {
      const parts = [
        item.shortId,
        item.tagName,
        item.role ? `role=${item.role}` : null,
        item.name ? `name=${JSON.stringify(item.name)}` : null,
        item.ariaLabel ? `aria=${JSON.stringify(item.ariaLabel)}` : null,
        item.textPreview ? `text=${JSON.stringify(item.textPreview.slice(0, 60))}` : null,
      ].filter(Boolean);

      return `- ${parts.join(' | ')}`;
    })
    .join('\n');
}
