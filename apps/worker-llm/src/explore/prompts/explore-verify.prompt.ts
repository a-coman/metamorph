import type { MrIntent } from '@metamorph/core';
import type { ExplorePhase, ExploreSourceReference } from '../infrastructure/graph/explore-state.js';

export function buildExploreVerifySystemPrompt(phase: ExplorePhase): string {
  const lines = [
    'You verify exploration checkpoints for metamorphic testing using BEFORE and AFTER screenshots.',
    'Return ONLY valid JSON: { "verdict": "ok"|"fail"|"goal_reached", "rationale": string }',
    '',
    'Verdict rules (read carefully):',
    '- goal_reached: the PHASE GOAL is fully satisfied in the AFTER state (screenshot + URL after).',
    '  Use this when no further steps are needed for this phase.',
    '  Example source: results/listing page with search query applied (URL often contains /s?k= or similar, product grid visible).',
    '- ok: the executed batch worked and moved toward the goal, but the PHASE GOAL is NOT fully met yet — more steps are needed.',
    '  Do NOT use ok when the phase goal is already satisfied.',
    '- fail: steps did not work, page did not advance, probe error, or state regressed.',
    '',
    'IMPORTANT: If the after screenshot/URL already shows the phase goal is met, return goal_reached — not ok.',
    'Compare the BEFORE and AFTER screenshots visually to judge progress.',
  ];

  if (phase === 'follow_up') {
    lines.push(
      '',
      'follow_up verification:',
      '- Partial progress toward the source end state (search results with filter applied) should be verdict=ok, not fail.',
      '- goal_reached only when the filter action from source was repeated on the results page (idempotence step done).',
      '- Compare URL/state against the source end URL when provided.',
    );
  }

  return lines.join('\n');
}

export function buildExploreVerifyUserText(input: {
  url: string;
  urlAfter: string;
  phase: ExplorePhase;
  mrIntent: MrIntent;
  validatedSteps: { source: unknown[]; follow_up: unknown[] };
  sourceReference?: ExploreSourceReference;
  executedSteps: unknown[];
  probeError?: string;
}): string {
  const phaseGoal =
    input.phase === 'source'
      ? input.mrIntent.exploration.source_phase_goal
      : input.mrIntent.exploration.follow_up_phase_goal;

  const phaseValidatedSteps =
    input.validatedSteps[input.phase as keyof typeof input.validatedSteps];

  const lines = [
    `Session URL: ${input.url}`,
    `URL after probe: ${input.urlAfter}`,
    `Phase: ${input.phase}`,
    `Phase goal: ${phaseGoal}`,
    '',
    'Exploration phase goals:',
    `- source: ${input.mrIntent.exploration.source_phase_goal}`,
    `- follow_up: ${input.mrIntent.exploration.follow_up_phase_goal}`,
    '',
    'Validated steps in this phase (before this batch):',
    JSON.stringify(phaseValidatedSteps, null, 2),
  ];

  if (input.phase === 'follow_up' && input.sourceReference) {
    lines.push(
      '',
      'Validated source steps (reference):',
      JSON.stringify(input.sourceReference.steps, null, 2),
    );
    if (input.sourceReference.endUrl) {
      lines.push(`Source end URL (target state): ${input.sourceReference.endUrl}`);
    }
  }

  lines.push(
    '',
    'Executed steps (this batch only):',
    JSON.stringify(input.executedSteps, null, 2),
  );

  if (input.probeError) {
    lines.push('', `Probe error: ${input.probeError}`);
  }

  lines.push(
    '',
    'Two screenshots are attached: BEFORE (first image) and AFTER (second image) the probe batch.',
    'Does the AFTER state satisfy the phase goal? If yes → goal_reached. If partial progress → ok. If broken → fail.',
  );

  return lines.join('\n');
}
