import type { MrIntent, PageSnapshotInventory, SlotStep } from '@metamorph/core';
import type {
  ExplorePhase,
  ExploreSourceReference,
  ExploreBatchLog,
} from '../infrastructure/graph/explore-state.js';
import { formatBatchLogForPrompt } from '../infrastructure/graph/batch-log.js';
import { buildEnrichedInventorySection } from './inventory-summary.js';
import { PLAN_EXPLORE_OPTIONS } from './plan-explore.config.js';

const PLAN_EXPLORE_EXAMPLE_ONE_STEP = {
  action: 'append_steps',
  rationale:
    'Cookie banner blocks the main UI. Dismiss it using the accept button from Current inventory.',
  steps: [{ id: 1, action: 'click', element_id: 'E42' }],
};

const PLAN_EXPLORE_EXAMPLE_TWO_STEPS = {
  action: 'append_steps',
  rationale:
    'Searchbox is visible. Fill it from Current inventory, then press Enter to submit the search.',
  steps: [
    { id: 1, action: 'fill', element_id: 'E1', value: 'portatil' },
    { id: 2, action: 'press', element_id: 'E1', key: 'Enter' },
  ],
};

const PLAN_EXPLORE_EXAMPLE_THREE_STEPS = {
  action: 'append_steps',
  rationale:
    'Cookie banner blocks the page. Click its accept/dismiss control from Current inventory, fill the searchbox from Current inventory, then press Enter.',
  steps: [
    { id: 1, action: 'click', element_id: 'E42' },
    { id: 2, action: 'fill', element_id: 'E1', value: 'portatil' },
    { id: 3, action: 'press', element_id: 'E1', key: 'Enter' },
  ],
};

function buildAllowedValuesSection(): string {
  const { topLevelActions, stepActions, maxStepsPerBatch } = PLAN_EXPLORE_OPTIONS;

  return [
    'Allowed values (pick ONLY from these):',
    `- action: ${topLevelActions.join(' | ')}`,
    `- steps[].action: ${stepActions.join(' | ')}`,
    `- steps: required when action=append_steps; omit otherwise; max ${maxStepsPerBatch} items per batch`,
  ].join('\n');
}

export function buildMrSummary(mrIntent: MrIntent): string {
  const { transformation, relation } = mrIntent.mr_definition;

  return [
    `- transformation (${transformation.transform_family}): ${transformation.description}`,
    `- relation (${relation.type} on ${relation.on.join(', ')}): ${relation.description}`,
  ].join('\n');
}

export function summarizeStepsForReference(steps: SlotStep[]): string[] {
  return steps.map((step, index) => {
    const prefix = `${index + 1}.`;

    switch (step.action) {
      case 'goto':
        return `${prefix} goto ${step.url ?? '(url missing)'}`;
      case 'click':
        return `${prefix} click`;
      case 'fill':
        return `${prefix} fill${step.value !== undefined ? ` → ${JSON.stringify(step.value)}` : ''}`;
      case 'selectOption':
        return `${prefix} selectOption${step.value !== undefined ? ` → ${JSON.stringify(step.value)}` : ''}`;
      case 'press':
        return `${prefix} press ${step.key ?? 'Enter'}`;
      case 'scroll':
        return `${prefix} scroll`;
      case 'waitFor':
        return `${prefix} waitFor`;
      default:
        return `${prefix} ${step.action}`;
    }
  });
}

export function buildCompletedSourceReferenceSection(
  sourceReference: ExploreSourceReference,
): string {
  const actionLines = summarizeStepsForReference(sourceReference.steps);

  return [
    'Completed source phase (reference only — do NOT reuse element_ids or locators from source):',
    '- status: completed',
    `- end_url: ${sourceReference.endUrl ?? 'null'}`,
    '- action_sequence:',
    ...actionLines.map((line) => `  ${line}`),
    '- note: Map each action to a matching item in Current inventory; element_ids are reassigned every snapshot.',
  ].join('\n');
}

export function buildPlanExploreSystemPrompt(): string {
  return [
    'You plan incremental Playwright steps for metamorphic testing exploration.',
    'Return ONLY valid JSON matching this shape (no markdown, no extra keys):',
    '{',
    '  "action": string,',
    '  "steps": [',
    '    {',
    '      "id": number,',
    '      "action": string,',
    '      "element_id": string,',
    '      "value": string,',
    '      "url": string,',
    '      "key": string,',
    '      "scroll_y": number,',
    '      "timeout_ms": number',
    '    }',
    '  ],',
    '  "rationale": string',
    '}',
    '',
    buildAllowedValuesSection(),
    '',
    'Rules:',
    '- Every enum field must use exactly one of the allowed values above; do not invent new values.',
    '- Each step MUST include "id" (positive integer, unique within the batch) and "action" (never "type").',
    '- Use ONLY element_id values from the Current inventory in the user message.',
    '- element_ids in examples and source reference are NOT valid targets; never copy them — pick from Current inventory for the attached screenshot.',
    '- click, fill, and selectOption MUST include element_id.',
    '- fill is ONLY allowed on inventory items marked fillable.',
    '- If the target element for the phase goal is not in Current inventory, plan only steps using existing element_ids (dismiss overlays, click triggers, waitFor). Do not plan fill or click on absent elements; wait for the next snapshot.',
    '- Plan toward the current phase goal stated in the user message.',
    '- Each phase is an independent Playwright scenario replayed from the homepage with a new browser context.',
    '- Plan only toward the current phase goal; do not assume follow_up must copy or repeat source unless the follow_up phase goal explicitly requires it.',
    '- When phase is follow_up, use the source action_sequence and end_url as semantic context for what source achieved; plan follow_up in concordance with the follow_up phase goal and MR summary.',
    '- If the validated path in the current phase is empty, start with goto to the target URL when needed.',
    '- When the screenshot shows a cookie banner, modal, or overlay blocking the main UI, dismiss it before progressing toward the phase goal.',
    '- Do not repeat steps already present in the validated path unless the phase goal requires it.',
    '- Prefer fill + press Enter for search boxes over ambiguous clicks.',
    '- Goals must be achievable without login; avoid account walls, checkout, and captcha flows.',
    '- Return action=scenario_complete when the phase goal is already satisfied in the screenshot.',
    '- Return action=abort when the phase goal cannot be achieved on this page (impossible MR, unrecoverable auth/captcha, or no viable path after probe failures). This ends exploration immediately.',
    '- Do NOT use abort for dismissible cookies or modals, or recoverable steps — plan append_steps to continue instead.',
    '- After a probe failure, prefer append_steps with a different approach; use abort only when continuing is pointless.',
    '- Do not repeat batches listed under Errors in the user message.',
    '- If a batch committed overlay dismissal, plan the next sub-goal (e.g. fill destination, submit search) — do not dismiss the same overlays again.',
    '- element_ids from failed batches or screenshots may not match Current inventory; always pick from Current inventory for the attached screenshot.',
    '- After a probe failure, read Errors and the second screenshot (if present).',
    '- The second screenshot shows the page immediately BEFORE the latest probe failure; do NOT use element_ids from that image — only Current inventory applies to the first screenshot.',
    '- Page structure is hierarchical context only; use ONLY element_id values listed under Current inventory in steps.',
    '- Lines marked → E{n} in Page structure link tree nodes to inventory; do not invent element_ids from unannotated tree lines.',
    '- The annotated screenshot and Current inventory remain the visual source of truth for element selection.',
    'Examples (plan 1, 2, or 3 steps per batch):',
    '1 step:',
    JSON.stringify(PLAN_EXPLORE_EXAMPLE_ONE_STEP, null, 2),
    '2 steps:',
    JSON.stringify(PLAN_EXPLORE_EXAMPLE_TWO_STEPS, null, 2),
    '3 steps:',
    JSON.stringify(PLAN_EXPLORE_EXAMPLE_THREE_STEPS, null, 2),
  ].join('\n');
}

export function buildPlanExploreUserText(input: {
  url: string;
  phase: ExplorePhase;
  mrIntent: MrIntent;
  inventory: PageSnapshotInventory;
  batchLog: ExploreBatchLog;
  sourceReference?: ExploreSourceReference;
  latestProbeFailureBatch?: number;
}): string {
  const phaseGoal =
    input.phase === 'source'
      ? input.mrIntent.exploration.source_phase_goal
      : input.mrIntent.exploration.follow_up_phase_goal;

  const { historySection, validatedSection, errorsSection, latestProbeFailureBatch } =
    formatBatchLogForPrompt(input.batchLog, input.phase);

  const lines = [
    `Target URL: ${input.url}`,
    `Phase: ${input.phase}`,
    `Phase goal: ${phaseGoal}`,
    '',
    'MR summary:',
    buildMrSummary(input.mrIntent),
    '',
    historySection,
    '',
    validatedSection,
  ];

  if (input.phase === 'follow_up' && input.sourceReference) {
    lines.push('', buildCompletedSourceReferenceSection(input.sourceReference));
  }

  const probeFailureBatch = input.latestProbeFailureBatch ?? latestProbeFailureBatch;
  if (probeFailureBatch !== undefined) {
    lines.push(
      '',
      'Attached:',
      '1. Current inventory screenshot — element_id labels match the inventory below.',
      `2. Probe failure context (Batch ${probeFailureBatch}) — page state immediately BEFORE the failed step (labels may not apply).`,
    );
  } else {
    lines.push(
      '',
      'Attached: annotated screenshot — element_id labels on the image match the inventory below.',
    );
  }

  lines.push('', buildEnrichedInventorySection(input.inventory));
  lines.push('', errorsSection);

  lines.push(
    '',
    'Propose the next 1-3 steps, scenario_complete if the phase goal is already met, or abort only for unrecoverable blockers.',
  );

  return lines.join('\n');
}
