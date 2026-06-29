import type { MrIntent, PageSnapshotInventory } from '@metamorph/core';
import { buildInventoryItemsSummary } from './inventory-summary.js';

export function buildObservationAnchorSystemPrompt(): string {
  return [
    'You identify the DOM element whose text summarizes how many search/listing results match.',
    'Return ONLY valid JSON matching this shape (no markdown, no extra keys):',
    '{',
    '  "label_element_id": string,',
    '  "number_index": number,',
    '  "rationale": string',
    '}',
    '',
    'Rules:',
    '- label_element_id MUST be an observation inventory shortId (e.g. E12) from the provided list.',
    '- Observation inventory IDs (E1, E2, …) are separate from action/inventory labels on other screenshots.',
    '- Pick the element whose visible text reports result counts (e.g. "1-48 of over 30,000 results").',
    '- Do NOT pick the search bar, header chrome, footer, or sidebar.',
    '- number_index is 0-based: which numeric token in that text is the total result count.',
    '  Example: "1-48 de más de 30.000 resultados" has numbers [1, 48, 30000] in order → number_index: 2 for the total.',
    '- If unsure, prefer the result info bar / breadcrumb label over the results grid container.',
  ].join('\n');
}

export function buildObservationAnchorUserText(input: {
  url: string;
  mrIntent: MrIntent;
  inventory: PageSnapshotInventory;
}): string {
  const observationItems = input.inventory.observationItems ?? [];

  return [
    `URL: ${input.url}`,
    `MR transformation: ${input.mrIntent.mr_definition.transformation.description}`,
    '',
    'Observation inventory (shortId → metadata; use ONLY these IDs for label_element_id):',
    observationItems.length > 0
      ? buildInventoryItemsSummary(observationItems)
      : '(no observation inventory — snapshot predates observation capture)',
    '',
    'Attached: raw screenshot without on-image labels (results visible).',
    'Identify the result-count label element_id and which number_index is the total count.',
  ].join('\n');
}
