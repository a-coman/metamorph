import type { MrIntent, PageSnapshotInventory, SlotStep } from '@metamorph/core';
import type {
  ExplorePhase,
  ExploreSourceReference,
  ProbeFailureContext,
} from '../infrastructure/graph/explore-state.js';
import { buildInventorySummary } from './inventory-summary.js';
import { PLAN_EXPLORE_OPTIONS } from './plan-explore.config.js';

const PLAN_EXPLORE_EXAMPLE = {
  action: 'append_steps',
  rationale:
    'Cookie banner blocks the page. Click its accept/dismiss control from Current inventory, fill the searchbox from Current inventory, then press Enter.',
  steps: [
    { id: 1, action: 'click', element_id: 'E42' },
    { id: 2, action: 'fill', element_id: 'E01', value: 'portatil' },
    { id: 3, action: 'press', element_id: 'E01', key: 'Enter' },
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
    '- After a probe failure, read the Last probe failure section and the second screenshot (if present).',
    '- The second screenshot shows the page immediately BEFORE the failed step; do NOT use element_ids from that image — only Current inventory applies to the first screenshot.',
    '- Use url_before_failure to detect unwanted navigation (e.g. a deep-link left the homepage before a homepage-only control was clicked).',
    '- After a probe failure, prefer append_steps with a different approach; use abort only when continuing is pointless.',
    'Example:',
    JSON.stringify(PLAN_EXPLORE_EXAMPLE, null, 2),
  ].join('\n');
}

export function buildPlanExploreUserText(input: {
  url: string;
  phase: ExplorePhase;
  mrIntent: MrIntent;
  inventory: PageSnapshotInventory;
  validatedSteps: { source: unknown[]; follow_up: unknown[] };
  sourceReference?: ExploreSourceReference;
  probeError?: string;
  probeFailureContext?: ProbeFailureContext;
  batchSize?: number;
}): string {
  const phaseGoal =
    input.phase === 'source'
      ? input.mrIntent.exploration.source_phase_goal
      : input.mrIntent.exploration.follow_up_phase_goal;

  const lines = [
    `Target URL: ${input.url}`,
    `Phase: ${input.phase}`,
    `Phase goal: ${phaseGoal}`,
    '',
    'MR summary:',
    buildMrSummary(input.mrIntent),
    '',
    'Validated steps in this phase:',
    JSON.stringify(input.validatedSteps[input.phase], null, 2),
  ];

  if (input.phase === 'follow_up' && input.sourceReference) {
    lines.push('', buildCompletedSourceReferenceSection(input.sourceReference));
  }

  if (input.probeFailureContext) {
    lines.push(
      '',
      'Attached:',
      '1. Current inventory screenshot — element_id labels match the inventory below.',
      '2. Probe failure context — page state immediately BEFORE the failed step (labels may not apply).',
    );
  } else {
    lines.push(
      '',
      'Attached: annotated screenshot — element_id labels on the image match the inventory below.',
    );
  }

  lines.push('', 'Current inventory:', buildInventorySummary(input.inventory));

  if (input.probeFailureContext) {
    const ctx = input.probeFailureContext;
    const batchLabel =
      ctx.failedBatchIndex !== undefined && input.batchSize !== undefined
        ? ` (batch index ${ctx.failedBatchIndex + 1} of ${input.batchSize})`
        : ctx.failedBatchIndex !== undefined
          ? ` (batch index ${ctx.failedBatchIndex + 1})`
          : '';

    lines.push(
      '',
      'Last probe failure:',
      `- error: ${input.probeError ?? '(none)'}`,
      `- url before failure: ${ctx.urlBeforeFailure}`,
      `- failed step${batchLabel}: ${JSON.stringify(ctx.failedStep, null, 2)}`,
    );
  } else if (input.probeError) {
    lines.push('', `Last probe/plan error: ${input.probeError}`);
  }

  lines.push(
    '',
    'Propose the next 1-3 steps, scenario_complete if the phase goal is already met, or abort only for unrecoverable blockers.',
  );

  return lines.join('\n');
}
