import type {
  MrIntent,
  ObservableCompare,
  PageSnapshotInventory,
  SlotStep,
  TransformFamily,
} from '@metamorph/core';
import {
  getFamilyProfile,
  ObservableValueTypeSchema,
  OBSERVE_SPEC_MIN_OBSERVABLES,
  OBSERVE_SPEC_MAX_OBSERVABLES,
} from '@metamorph/core';
import { buildInventoryItemsSummary } from './inventory-summary.js';

export function buildObserveSpecSystemPrompt(transformFamily: TransformFamily): string {
  const profile = getFamilyProfile(transformFamily);
  const allowedCompares = profile.allowedCompares.join(' | ');
  const allowedValueTypes = ObservableValueTypeSchema.options.join(' | ');

  return [
    'You specify what to observe on a web page after the source exploration phase completes.',
    '<output_format>',
    'Return ONLY valid JSON matching this shape (no markdown, no extra keys):',
    '{',
    '  "observables": [',
    '    {',
    '      "key": string,',
    `      "valueType": ${allowedValueTypes},`,
    `      "compare": ${allowedCompares},`,
    '      "binding": { "kind": string, ... },',
    '      "rationale": string',
    '    }',
    '  ]',
    '}',
    '</output_format>',
    '',
    '<binding_kinds>',
    'Binding kinds (use inventory_snapshot_id from user message for every binding):',
    '- input_value: { kind, inventory_snapshot_id, element_id } — read input value from fillable field',
    '- text_content: { kind, inventory_snapshot_id, element_id } — read visible text',
    '- number_from_label: { kind, inventory_snapshot_id, element_id, number_index } — parse number from label text',
    '- url_pathname: { kind, inventory_snapshot_id } — pathname only',
    '- url_params: { kind, inventory_snapshot_id, param_keys: string[] } — stable query params only',
    '- list_texts: { kind, inventory_snapshot_id, element_ids: string[] } — text from multiple elements',
    '- presence: { kind, inventory_snapshot_id, element_id } — boolean whether element is visible',
    '- composite: { kind, inventory_snapshot_id, separator, parts: [{ element_id, extract: "input_value"|"text_content", prefix? }] }',
    '',
    '</binding_kinds>',
    '<rules>',
    `- Pick ${OBSERVE_SPEC_MIN_OBSERVABLES} to ${OBSERVE_SPEC_MAX_OBSERVABLES} observables that should be stable under the MR transformation.`,
    '- Keys must be snake_case (e.g. search_query, result_count, active_filters).',
    `- Allowed compare operators for this family: ${allowedCompares}.`,
    '- element_id MUST be from observation inventory shortIds (E1, E2, ...) in the user message.',
    '- Prefer stable signals: form values, result labels, filter chips, pathname.',
    '- Avoid session tokens and opaque URL params (e.g. c=, sid=) unless clearly stable.',
    '- For idempotence: observables should not change when the transformation is applied correctly.',
    '- For subset: include a numeric count observable with compare cardinality_lte when relevant.',
    '- number_index is 0-based index into parsed numbers in label text.',
    '- Each observable needs a concise rationale tied to the MR transformation.',
    '</rules>',
  ].join('\n');
}

export function buildObserveSpecUserText(input: {
  url: string;
  transformFamily: TransformFamily;
  mrIntent: MrIntent;
  inventory: PageSnapshotInventory;
  inventorySnapshotId: string;
  sourceSteps: SlotStep[];
  observationIntents?: string[];
  rejectionReason?: string;
}): string {
  const observationItems = input.inventory.observationItems ?? [];
  const intents =
    input.observationIntents ??
    input.mrIntent.observation_intents ??
    [];

  const stepSummary = input.sourceSteps.map((step) => {
    const parts: string[] = [step.action];
    if (step.element_id) parts.push(`element_id=${step.element_id}`);
    if (step.value) parts.push(`value=${step.value}`);
    return `- ${parts.join(' ')}`;
  });

  return [
    `URL: ${input.url}`,
    `inventory_snapshot_id: ${input.inventorySnapshotId}`,
    `Transform family: ${input.transformFamily}`,
    `Transformation: ${input.mrIntent.mr_definition.transformation.description}`,
    `Relation intent: ${input.mrIntent.mr_definition.relation.description}`,
    intents.length > 0
      ? `Observation intents from MR plan:\n${intents.map((i) => `- ${i}`).join('\n')}`
      : '',
    input.rejectionReason
      ? [
          '',
          'Previous observe_spec attempt was rejected:',
          `- ${input.rejectionReason}`,
          'Fix bindings and compare operators; do not repeat the same mistake.',
        ].join('\n')
      : '',
    '',
    'Committed source steps (semantic context):',
    stepSummary.length > 0 ? stepSummary.join('\n') : '(none)',
    '',
    'Observation inventory (shortId → metadata; use ONLY these IDs in bindings):',
    observationItems.length > 0
      ? buildInventoryItemsSummary(observationItems)
      : '(no observation inventory)',
    '',
    'Attached: raw screenshot of source end state (results page).',
    'Define observables with bindings for this page and MR.',
  ]
    .filter(Boolean)
    .join('\n');
}

export function isCompareAllowed(
  transformFamily: TransformFamily,
  compare: ObservableCompare,
): boolean {
  return getFamilyProfile(transformFamily).allowedCompares.includes(compare);
}
