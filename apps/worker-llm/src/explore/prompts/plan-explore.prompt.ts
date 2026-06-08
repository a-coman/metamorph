import type { MrIntent, PageSnapshotInventory } from '@metamorph/core';
import type { ExplorePhase, ExploreSourceReference } from '../infrastructure/graph/explore-state.js';
import { buildInventorySummary } from './inventory-summary.js';

const PLAN_STEP_EXAMPLE = JSON.stringify(
  {
    action: 'append_steps',
    rationale: 'Navigate to search and apply filter.',
    steps: [
      { id: 1, action: 'goto', url: 'https://example.com' },
      { id: 2, action: 'click', element_id: 'E01' },
      { id: 3, action: 'waitFor', timeout_ms: 2000 },
    ],
  },
  null,
  2,
);

export function buildPlanExploreSystemPrompt(phase: ExplorePhase): string {
  const lines = [
    'You plan incremental Playwright steps for metamorphic testing exploration.',
    'Return ONLY valid JSON matching this example shape (use "action" on each step, NOT "type"):',
    PLAN_STEP_EXAMPLE,
    'Top-level fields: action ("append_steps"|"scenario_complete"|"abort"), steps? (array), rationale (string at top level).',
    'Rules:',
    '- Use ONLY element_id values from the CURRENT inventory snapshot.',
    '- Propose at most 3 steps per batch.',
    '- Each step MUST include "id" (positive integer, unique within the batch) and "action" (never "type").',
    '- click/fill/selectOption MUST include element_id from the current inventory.',
    '- If validated path in this phase is empty, the first step MUST be goto with the target URL (probe replay may prepend goto when missing — still plan toward the phase goal).',
    '- Allowed step actions: goto, click, fill, selectOption, press, scroll, waitFor.',
    '- When the screenshot shows a cookie consent banner, modal, or other overlay blocking the main UI, dismiss or accept it as the first step(s) in your batch using element_ids from the current inventory (before search, filter, or navigation toward the phase goal).',
    '- If no blocking overlay is visible, proceed directly toward the phase goal.',
    '- When the phase goal is already met in the current screenshot/URL, return action=scenario_complete.',
    '- Do not propose steps that repeat an action already in validated steps unless the phase goal requires it.',
    '- Reserve action=abort for unrecoverable blockers only (captcha, hard auth wall).',
  ];

  if (phase === 'follow_up') {
    lines.push(
      '',
      'follow_up phase specifics:',
      '- follow_up is an INDEPENDENT Playwright scenario replayed from the homepage (validated follow_up path starts empty).',
      '- Use validated source steps as reference for which filter/search action to repeat.',
      '- Build toward the same filtered results state as source (see source end URL), then repeat that filter action once.',
      '- An empty follow_up validated path at the start is EXPECTED — do not abort for that reason alone.',
    );
  }

  return lines.join('\n');
}

export function buildPlanExploreUserText(input: {
  url: string;
  phase: ExplorePhase;
  mrIntent: MrIntent;
  inventory: PageSnapshotInventory;
  validatedSteps: { source: unknown[]; follow_up: unknown[] };
  sourceReference?: ExploreSourceReference;
  probeError?: string;
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
    'MR intent (full):',
    JSON.stringify(input.mrIntent, null, 2),
    '',
    'Exploration phase goals:',
    `- source: ${input.mrIntent.exploration.source_phase_goal}`,
    `- follow_up: ${input.mrIntent.exploration.follow_up_phase_goal}`,
    '',
    'Validated steps in this phase:',
    JSON.stringify(input.validatedSteps[input.phase], null, 2),
  ];

  if (input.phase === 'follow_up' && input.sourceReference) {
    lines.push(
      '',
      'Validated source steps (reference — replicate end state and filter action):',
      JSON.stringify(input.sourceReference.steps, null, 2),
    );
    if (input.sourceReference.endUrl) {
      lines.push(
        `Source end URL (target state to reach before repeating filter): ${input.sourceReference.endUrl}`,
      );
    }
  }

  lines.push(
    '',
    'Current inventory:',
    buildInventorySummary(input.inventory),
  );

  if (input.probeError) {
    lines.push('', `Last probe error: ${input.probeError}`);
  }

  lines.push('', 'Propose the next 1-3 steps OR scenario_complete if goal reached.');

  return lines.join('\n');
}
