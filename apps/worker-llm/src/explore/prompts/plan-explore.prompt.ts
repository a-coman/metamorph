import type { MrIntent, PageSnapshotInventory } from '@metamorph/core';
import {
  ExplorePlanActionSchema,
  SlotActionSchema,
  PLAN_EXPLORE_MAX_STEPS_PER_BATCH,
} from '@metamorph/core';
import type {
  ExplorePhase,
  ExploreSourceReference,
  ExploreBatchLog,
} from '../infrastructure/graph/explore-state.js';
import { formatBatchLogForPrompt } from '../infrastructure/graph/batch-log.js';
import { buildEnrichedInventorySection } from './inventory-summary.js';

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
    'I can see all elements that make sense to click on current inventory, and Im sure each step is independent (elements_ids and their positions on the page wont change after each independent step) so we can plan them all at once. Cookie banner blocks the page. Click its accept/dismiss control from Current inventory, fill the searchbox from Current inventory, then press Enter.',
  steps: [
    { id: 1, action: 'click', element_id: 'E42' },
    { id: 2, action: 'fill', element_id: 'E1', value: 'laptop' },
    { id: 3, action: 'press', element_id: 'E1', key: 'Enter' },
  ],
};

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

function buildSystemPromptSemanticsSection(): string {
  const planActions = ExplorePlanActionSchema.options.join(' | ');
  const stepActions = SlotActionSchema.options.join(' | ');

  return [
    'Top-level fields:',
    `- action (required): ${planActions}`,
    '  append_steps: plan the next probe batch (1 to ' +
      `${PLAN_EXPLORE_MAX_STEPS_PER_BATCH} steps).`,
    '  scenario_complete: current phase goal is already satisfied; no further steps needed.',
    '  abort: phase goal is permanently unachievable (auth wall, captcha, impossible MR).',
    '- rationale (required): concise explanation (~500 chars max). Name concrete actions and values so follow_up can reuse semantics without element_ids.',
    `- steps: required when action=append_steps (${PLAN_EXPLORE_MAX_STEPS_PER_BATCH} max); omit for scenario_complete and abort.`,
    '',
    'Step object fields (only inside steps when action=append_steps):',
    `- id (required): positive integer, unique within the batch.`,
    `- action (required): ${stepActions}.`,
    '- element_id (conditional): inventory shortId (E1, E2, ...) from current <inventory>...</inventory> in the user message.',
    '  Required for click, fill, selectOption. Omit for scroll and waitFor. Optional for press.',
    '- value (conditional): text to type or option to select.',
    '  Required for fill and selectOption (selectOption value must exactly match an option from the inventory item).',
    '- url (conditional): absolute URL to navigate to. Required for goto only.',
    '- key (conditional): keyboard key name (e.g. Enter, Tab). Required for press only.',
    '- scroll_y (conditional): pixels to scroll; positive scrolls down, negative scrolls up. Required for scroll only.',
    '- timeout_ms (conditional): wait duration in milliseconds. Optional for waitFor only (defaults to 2000 if omitted).',
    '',
    'Step action semantics:',
    '- click: click the inventory element identified by element_id.',
    '- fill: type value into a fillable inventory item (input, textarea, or combobox). It only works for items marked fillable in the current <inventory>...</inventory>.',
    '- selectOption: choose value on a native <select> or combobox that lists options in inventory.',
    '- press: send key to the page.',
    '- scroll: scroll the viewport without targeting an element.',
    '- waitFor: pause until timeout_ms elapses (e.g. wait for lazy content).',
    '- goto: navigate to url (rare during exploration; we already start at the Target URL).',
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

export function buildPlanExploreSystemPrompt(): string {
  return `You plan incremental Playwright steps for metamorphic testing exploration.

<output_format>
Return ONLY valid JSON matching this exact shape (no markdown formatting, no extra keys):
{
  "action": string,
  "steps": [
    {
      "id": number,
      "action": string,
      "element_id": string,
      "value": string,
      "url": string,
      "key": string,
      "scroll_y": number,
      "timeout_ms": number
    }
  ],
  "rationale": string (keep concise, ~500 chars max. Name concrete actions/values so follow_up can reuse semantics without element_ids)
}
</output_format>

<semantics>
${buildSystemPromptSemanticsSection()}
</semantics>

<constraints>
- JSON SCHEMA: Every enum field must use exactly one of the allowed values from the <semantics>...</semantics> section. Do not invent values.
- ELEMENT IDs: You MUST ONLY use \`element_id\` values from the current <inventory>...</inventory> in the user message. Do not invent IDs. Do not reuse IDs from examples, source references, or failed batches — they change every snapshot. If an item lacks an on-image label, refer to the current <inventory>...</inventory> as the source of truth (not always all items have on-image labels).
</constraints>

<interaction_rules>
- TARGET ACQUISITION: If the target for the phase goal is not in the current <inventory>...</inventory>, plan a \`scroll\` or \`waitFor\` to reveal it, or use existing \`element_id\`s to dismiss blocking overlays/cookie banners.
- SCROLLING: Use positive \`scroll_y\` to scroll down, negative to scroll up. Omit \`element_id\` for scroll steps.
- FILL & SELECT: \`fill\` is ONLY for inventory items marked fillable. \`selectOption\` is ONLY for items with an options list (native <select> or role=combobox). The \`selectOption\` value MUST be an exact match from the item's options list.
- SEARCH BOXES: Prefer \`fill\` + press Enter over ambiguous clicks.
- STEP BATCHING: Prefer planning one step at a time, unless you see all necessary elements in the current <inventory>...</inventory> and you are certain that the steps are independent (their positions and element_ids on the page wont change after each independent step) and can be executed in one batch.
</interaction_rules>

<exploration_strategy>
- PHASE GOALS: Plan only toward the current phase goal. Match generic intents (e.g., "search box", "filter chip") to concrete \`element_id\`s in the current <inventory>...</inventory>.
- FOLLOW UP: For \`follow_up\` phases, use the source \`explored_steps\` and \`end_url\` as semantic context, but plan in concordance with the follow_up phase goal. Do not assume you must copy the source phase.
- ROBUSTNESS: Prefer stable controls (brand chips, toggles, native selects, star-rating links) over dynamic filters whose labels change with result sets.
- AVOIDANCE: Goals must be achievable without login. Avoid account walls, checkout flows, and captchas.
- COMPLETION: Return action="scenario_complete" when the phase goal is already satisfied in the screenshot.
</exploration_strategy>

<error_recovery>
- PROBE FAILURES: After a failure, read the errors in <exploration_history>...</exploration_history> and analyze the second screenshot (showing the page right before failure). Do not repeat failed approaches or reuse uncommitted batches, try new approaches from the current <inventory>...</inventory>. Prefer action="append_steps" with a new approach.
- OVERLAYS: If a previous batch dismissed an overlay, plan the next sub-goal. Do not dismiss the same overlay again.
- ABORT: Return action="abort" ONLY when the goal is permanently unachievable (impossible MR, unrecoverable auth/captcha). Do NOT abort for dismissible overlays or recoverable errors — plan append_steps instead.
</error_recovery>

<examples>
[1 step]
${JSON.stringify(PLAN_EXPLORE_EXAMPLE_ONE_STEP, null, 2)}

[2 steps]
${JSON.stringify(PLAN_EXPLORE_EXAMPLE_TWO_STEPS, null, 2)}

[3 steps]
${JSON.stringify(PLAN_EXPLORE_EXAMPLE_THREE_STEPS, null, 2)}

[scroll down (no element_id)]
${JSON.stringify(PLAN_EXPLORE_EXAMPLE_SCROLL_DOWN, null, 2)}

[scroll up (no element_id)]
${JSON.stringify(PLAN_EXPLORE_EXAMPLE_SCROLL_UP, null, 2)}
</examples>`;
}

export function buildPlanExploreUserPrompt(input: {
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
    '<goal>',
    `Target URL: ${input.url}`,
    `Phase: ${input.phase}`,
    `Phase goal: ${phaseGoal}`,
    '',
    'MR summary (semantic intent — map to current <inventory>...</inventory>; do not emit observation field names as element_id):',
    buildMrSummary(input.mrIntent),
    '</goal>',
    '',
    '<exploration_history>',
    historySection,
    '</exploration_history>'
  ];

  if (input.phase === 'follow_up' && input.sourceReference) {
    lines.push('', 
      '<source_reference>',
      buildCompletedSourceReferenceSection(input.sourceReference),
      '</source_reference>'
    );
  }


  lines.push('<attachments>');
  const probeFailureBatch = input.latestProbeFailureBatch ?? latestProbeFailureBatch;
  if (probeFailureBatch !== undefined) {
    lines.push(
      '',
      'Attached:',
      '1. Current annotated screenshot — on-image E labels match items in current <inventory>...</inventory> where labelShown.',
      `2. Probe failure context (Batch ${probeFailureBatch}) — raw page state immediately BEFORE the failed step (no on-image labels).`,
    );
  } else {
    lines.push(
      '',
      'Attached: annotated screenshot — element_id labels on the image match current <inventory>...</inventory> below.',
    );
  }
  lines.push('</attachments>');
  
  lines.push('', 
    '<inventory>',
    buildEnrichedInventorySection(input.inventory),
    '</inventory>'
  );

  lines.push(
    '',
    'Map the phase goal to 1-3 concrete steps using element_id values from current <inventory>...</inventory>, scenario_complete if the phase goal is already met, or abort only for unrecoverable blockers.',
  );

  return lines.join('\n');
}
