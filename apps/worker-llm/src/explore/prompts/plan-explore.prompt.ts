import type { MrIntent, PageSnapshotInventory } from '@metamorph/core';
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
    'A banner blocks the main UI. I need to plan only one step because I can only see one element that makes sense to click on current inventory. Dismiss it using the "x" button from Current inventory, and we will continue to the next step.',
  steps: [{ id: 1, action: 'click', element_id: 'E42' }],
};

const PLAN_EXPLORE_EXAMPLE_TWO_STEPS = {
  action: 'append_steps',
  rationale:
    'Searchbox is visible. Fill it from Current inventory, then press Enter to submit the search.',
  steps: [
    { id: 1, action: 'fill', element_id: 'E1', value: 'laptop' },
    { id: 2, action: 'press', element_id: 'E1', key: 'Enter' },
  ],
};

const PLAN_EXPLORE_EXAMPLE_THREE_STEPS = {
  action: 'append_steps',
  rationale:
    'I can see all elements that make sense to click on current inventory, and Im sure each step is independent enough that we can plan them all at once. Cookie banner blocks the page. Click its accept/dismiss control from Current inventory, fill the searchbox from Current inventory, then press Enter.',
  steps: [
    { id: 1, action: 'click', element_id: 'E42' },
    { id: 2, action: 'fill', element_id: 'E1', value: 'laptop' },
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
    `- relation (${relation.on.join(', ') || 'pending observables'}): ${relation.description}`,
  ].join('\n');
}

export function buildCompletedSourceReferenceSection(
  sourceReference: ExploreSourceReference,
): string {
  const exploredStepLines =
    sourceReference.exploredSteps.length === 0
      ? ['  (none recorded)']
      : sourceReference.exploredSteps.map((step, index) => `  ${index + 1}. ${step}`);

  return [
    'Completed source phase (semantic reference — do NOT reuse element_ids):',
    '- status: completed',
    `- end_url: ${sourceReference.endUrl ?? 'null'}`,
    '- explored_steps:',
    ...exploredStepLines,
  ].join('\n');
}

const PLAN_EXPLORE_EXAMPLE_SCROLL_DOWN = {
  action: 'append_steps',
  rationale:
    'Filters below the fold are not in Current inventory. Scroll the page down to reveal sidebar filters.',
  steps: [{ id: 1, action: 'scroll', scroll_y: 800 }],
};

const PLAN_EXPLORE_EXAMPLE_SCROLL_UP = {
  action: 'append_steps',
  rationale:
    'The search bar is above the current viewport after scrolling down. Scroll up to bring it back into view.',
  steps: [{ id: 1, action: 'scroll', scroll_y: -600 }],
};

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
    '      "element_id": string (omit for scroll),',
    '      "value": string,',
    '      "url": string,',
    '      "key": string,',
    '      "scroll_y": number (required for scroll),',
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
    '- You must only use element_id values from the Current Inventory in the user message. Do not invent element_ids. Element_ids from examples and source reference are NOT valid targets, they change in each snapshot so never copy them — pick from Current inventory. If you need to plan only one step, because you can only see one element on current inventory, that is valid. Its not valid to plan future element_ids, or infer them from previous runs as they change in each snapshot.',
    '- If the target element for the phase goal is not in Current inventory, plan scroll or waitFor to reveal it, or use existing element_ids for dismissals.',
    '- Prefer to plan one step at a time, unless you can see all elements that make sense to click on current inventory, and you are sure each step is independent enough that we can plan them all at once.',
    '- click, fill, and selectOption MUST include element_id.',
    '- scroll scrolls the page viewport relative to the current position; use positive scroll_y to scroll down and negative scroll_y to scroll up. Include scroll_y only and omit element_id (do not attach element_id to scroll steps).',
    '- waitFor and press omit element_id unless the action targets a specific inventory element.',
    '- fill is ONLY allowed on inventory items marked fillable.',
    '- selectOption is ONLY allowed on inventory items with an options list (native <select>) or tagName=select / role=combobox.',
    '- selectOption value MUST be an exact value from that item options list; never invent option values.',
    '- If a filter/sort control has no options list, use click instead of selectOption.',
    '- Plan toward the current phase goal stated in the user message.',
    '- MR summary and phase goal describe generic intent from mr_plan; your job is to bind each step to a concrete element_id from Current inventory on this snapshot.',
    '- When the phase goal names a control type (search box, filter chip, sort dropdown), pick the matching inventory item by role, name, or text — equivalents may differ across snapshots.',
    '- Each phase is an independent Playwright scenario replayed from the homepage with a new browser context.',
    '- Plan only toward the current phase goal; do not assume follow_up must copy or repeat source unless the follow_up phase goal explicitly requires it.',
    '- When phase is follow_up, use the source explored_steps and end_url as semantic context for what source achieved; plan follow_up in concordance with the follow_up phase goal and MR summary.',
    '- If no committed batches exist in Exploration history for the current phase, start with goto to the target URL when needed.',
    '- When the screenshot shows a cookie banner, modal, or overlay blocking the main UI, dismiss it before progressing toward the phase goal.',
    '- Do not repeat steps from committed batches in Exploration history unless the phase goal requires it.',
    '- Prefer fill + press Enter for search boxes over ambiguous clicks.',
    '- Goals must be achievable without login; avoid account walls, checkout, and captcha flows.',
    '- Return action=scenario_complete when the phase goal is already satisfied in the screenshot.',
    '- Return action=abort when the phase goal cannot be achieved on this page (impossible MR, unrecoverable auth/captcha, or no viable path after probe failures). This ends exploration immediately.',
    '- Do NOT use abort for dismissible cookies or modals, or recoverable steps — plan append_steps to continue instead.',
    '- After a probe failure, prefer append_steps with a different approach; use abort only when continuing is pointless.',
    '- Probe or checkpoint failure reverts the browser to the snapshot before the failed batch; committed batches in Exploration history stay committed — do not assume those steps were undone. But you must not reuse element_ids from failed batches, they change in each snapshot so never copy them — pick from Current inventory.',
    '- Keep rationale concise (about 500 characters max). Name concrete actions and values in rationale (search terms, filters, controls) so follow_up can reuse the same semantic decisions without element_ids.',
    '- Do not repeat uncommitted batches or their failed approaches in Exploration history.',
    '- If a batch committed overlay dismissal, plan the next sub-goal (e.g. fill destination, submit search) — do not dismiss the same overlays again.',
    '- After a probe failure, read the errors under that batch in Exploration history and the second screenshot (if present).',
    '- (if present) The second screenshot (raw, no labels) shows the page immediately BEFORE the latest probe failure; use Current inventory for step targets on the first annotated screenshot.',
    '- The annotated screenshot and Current inventory are the source of truth for element_id selection; not every inventory item has a visible on-image label.',
    'Examples (plan 1, 2, or 3 steps per batch):',
    '1 step:',
    JSON.stringify(PLAN_EXPLORE_EXAMPLE_ONE_STEP, null, 2),
    '2 steps:',
    JSON.stringify(PLAN_EXPLORE_EXAMPLE_TWO_STEPS, null, 2),
    '3 steps:',
    JSON.stringify(PLAN_EXPLORE_EXAMPLE_THREE_STEPS, null, 2),
    'scroll down (no element_id):',
    JSON.stringify(PLAN_EXPLORE_EXAMPLE_SCROLL_DOWN, null, 2),
    'scroll up (no element_id):',
    JSON.stringify(PLAN_EXPLORE_EXAMPLE_SCROLL_UP, null, 2),
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

  const { historySection, latestProbeFailureBatch } =
    formatBatchLogForPrompt(input.batchLog, input.phase);

  const lines = [
    `Target URL: ${input.url}`,
    `Phase: ${input.phase}`,
    `Phase goal: ${phaseGoal}`,
    '',
    'MR summary (semantic intent — map to Current inventory; do not emit observation field names as element_id):',
    buildMrSummary(input.mrIntent),
    '',
    historySection,
  ];

  if (input.phase === 'follow_up' && input.sourceReference) {
    lines.push('', buildCompletedSourceReferenceSection(input.sourceReference));
  }

  const probeFailureBatch = input.latestProbeFailureBatch ?? latestProbeFailureBatch;
  if (probeFailureBatch !== undefined) {
    lines.push(
      '',
      'Attached:',
      '1. Current annotated screenshot — on-image E labels match items in Current inventory where labelShown.',
      `2. Probe failure context (Batch ${probeFailureBatch}) — raw page state immediately BEFORE the failed step (no on-image labels).`,
    );
  } else {
    lines.push(
      '',
      'Attached: annotated screenshot — element_id labels on the image match Current inventory below.',
    );
  }

  lines.push('', buildEnrichedInventorySection(input.inventory));

  lines.push(
    '',
    'Map the phase goal to 1-3 concrete steps using element_id values from Current inventory, scenario_complete if the phase goal is already met, or abort only for unrecoverable blockers.',
  );

  return lines.join('\n');
}
