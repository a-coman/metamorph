import type { MrIntent } from '@metamorph/core';
import type { ExplorePhase, ExploreSourceReference } from '../infrastructure/graph/explore-state.js';
import { EXPLORE_VERIFY_OPTIONS } from './explore-verify.config.js';
import {
  buildCompletedSourceReferenceSection,
  buildMrSummary,
} from './plan-explore.prompt.js';

const EXPLORE_VERIFY_EXAMPLE = {
  verdict: 'ok',
  rationale:
    'Cookie banner was dismissed and navigation moved closer to the phase goal; target state not reached yet.',
};

function buildAllowedValuesSection(): string {
  const { verdicts } = EXPLORE_VERIFY_OPTIONS;

  return [
    'Allowed values (pick ONLY from these):',
    `- verdict: ${verdicts.join(' | ')}`,
  ].join('\n');
}

export function buildExploreVerifySystemPrompt(): string {
  return [
    'You verify an exploration checkpoint for metamorphic testing.',
    'You receive BEFORE and AFTER screenshots of a probe batch, plus context about the phase goal and MR.',
    'Return ONLY valid JSON matching this shape (no markdown, no extra keys):',
    '{',
    '  "verdict": string,',
    '  "rationale": string',
    '}',
    '',
    buildAllowedValuesSection(),
    '',
    'Verdict semantics:',
    '- goal_reached: the AFTER screenshot and URL after probe show the current phase goal is fully satisfied; no further steps are needed for this phase.',
    '- ok: the executed batch made progress toward the phase goal, but the phase goal is NOT fully satisfied yet.',
    '- fail: the batch did not work, the page did not advance toward the goal, state regressed, or a probe error indicates execution failure.',
    '',
    'Rules:',
    '- You are judging ONE probe batch (1-3 steps), NOT whether the entire phase goal is complete in a single batch.',
    '- The phase goal may require many batches. A batch that completes an early sub-step (e.g. dismiss cookies, or first search submission) is ok unless AFTER regressed or shows no useful change.',
    '- NEVER return fail merely because later sub-steps of the phase goal remain undone.',
    '- Important: Partial progress toward the phase goal is ok, not fail.',
    '- Your rationale MUST match your verdict: if you describe progress made, verdict MUST be ok or goal_reached, never fail.',
    '- Every enum field must use exactly one of the allowed values above; do not invent new values.',
    '- Judge primarily against the current phase goal in the user message, using the MR summary for metamorphic intent.',
    '- Compare BEFORE and AFTER screenshots visually; use URL after probe as supporting evidence.',
    '- If the phase goal is already satisfied in AFTER, return goal_reached — not ok.',
    '- Do not return ok when the phase goal is already fully met in AFTER.',
    '- When phase is follow_up, use the source action_sequence and end_url only as semantic context for what source achieved; judge follow_up against the follow_up phase goal.',
    '- Do not require follow_up to mirror source step-by-step unless the follow_up phase goal explicitly requires it.',
    '- Cookie banners, modals, or overlays dismissed during the batch count as progress if they unblock movement toward the goal.',
    '- Return fail when AFTER shows an error page, login wall, captcha, or clearly wrong state with no progress.',
    '',
    'Example:',
    JSON.stringify(EXPLORE_VERIFY_EXAMPLE, null, 2),
  ].join('\n');
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

  const lines = [
    `Target URL: ${input.url}`,
    `URL after probe: ${input.urlAfter}`,
    `Phase: ${input.phase}`,
    `Phase goal: ${phaseGoal}`,
    '',
    'MR summary:',
    buildMrSummary(input.mrIntent),
    '',
    'Validated steps in this phase (before this batch):',
    JSON.stringify(input.validatedSteps[input.phase], null, 2),
  ];

  if (input.phase === 'follow_up' && input.sourceReference) {
    lines.push('', buildCompletedSourceReferenceSection(input.sourceReference));
  }

  lines.push(
    '',
    'Executed steps (this batch only):',
    JSON.stringify(input.executedSteps, null, 2),
  );

  if (input.probeError) {
    lines.push('', `Probe note: ${input.probeError}`);
  }

  lines.push(
    '',
    'Attached: two screenshots — BEFORE (first image) and AFTER (second image) the probe batch.',
    '',
    'Judge THIS BATCH ONLY (executed steps above):',
    '- Did this batch move closer to the phase goal compared to BEFORE? → ok',
    '- Is the full phase goal now satisfied in AFTER? → goal_reached',
    '- Did the batch fail, regress, or leave the page unchanged/worse? → fail',
    '',
    'Do NOT use fail when the batch clearly advanced (e.g. homepage → search results, cookie dismissed, search re-submitted on results page) even if the phase goal lists more steps still pending.',
  );

  return lines.join('\n');
}
