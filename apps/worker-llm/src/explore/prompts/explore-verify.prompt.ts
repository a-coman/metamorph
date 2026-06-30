import type { MrIntent } from '@metamorph/core';
import type { ExplorePhase, ExploreSourceReference } from '../infrastructure/graph/explore-state.js';
import { EXPLORE_VERIFY_OPTIONS } from './explore-verify.config.js';
import {
  buildCompletedSourceReferenceSection,
  buildMrSummary,
} from './plan-explore.prompt.js';

const EXPLORE_VERIFY_EXAMPLE_OK_MODAL = {
  verdict: 'ok',
  rationale:
    'Sign-in modal and cookie banner were dismissed. Destination search not submitted yet, but the UI is unblocked for the next batch.',
};

const EXPLORE_VERIFY_EXAMPLE_OK_SEARCH = {
  verdict: 'ok',
  rationale:
    'Search was submitted and results page loaded. Phase goal may still need follow-up actions, but this batch advanced clearly.',
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
    '- fail is ONLY for no useful change, regression, or execution failure — NOT for incomplete phase goals.',
    '',
    'Rules:',
    '- You are judging ONE probe batch (1-3 steps), NOT whether the entire phase goal is complete in a single batch.',
    '- The phase goal may require many batches. A batch that completes an early sub-step (e.g. dismiss cookies, close a modal, first search submission) is ok unless AFTER regressed or shows no useful change.',
    '- NEVER return fail merely because later sub-steps of the phase goal remain undone (e.g. destination not filled yet, search not clicked yet, results not verified yet).',
    '- Important: Partial progress toward the phase goal is ok, not fail.',
    '- If BEFORE had blocking overlays (cookie banner, sign-in modal) and AFTER shows them gone or the main UI unblocked, return ok even when search/destination steps are still pending.',
    '- Your rationale MUST match your verdict: if you describe progress made, verdict MUST be ok or goal_reached, never fail.',
    '- Every enum field must use exactly one of the allowed values above; do not invent new values.',
    '- Judge primarily against the current phase goal in the user message, using the MR summary for metamorphic intent.',
    '- When a planner rationale is present, use it to understand the intended sub-goal for this batch; judge whether BEFORE→AFTER shows that intent was achieved or advanced.',
    '- Compare BEFORE and AFTER screenshots visually; use URL after probe as supporting evidence.',
    '- If the phase goal is already satisfied in AFTER, return goal_reached — not ok.',
    '- Do not return ok when the phase goal is already fully met in AFTER.',
    '- When phase is follow_up, use the source explored_steps and end_url only as semantic context for what source achieved; judge follow_up against the follow_up phase goal.',
    '- Do not require follow_up to mirror source step-by-step unless the follow_up phase goal explicitly requires it.',
    '- Cookie banners, modals, or overlays dismissed during the batch count as progress if they unblock movement toward the goal.',
    '- Return fail when AFTER shows an error page, login wall, captcha, or clearly wrong state with no progress.',
    '',
    'Examples:',
    JSON.stringify(EXPLORE_VERIFY_EXAMPLE_OK_MODAL, null, 2),
    JSON.stringify(EXPLORE_VERIFY_EXAMPLE_OK_SEARCH, null, 2),
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
  batchRationale?: string;
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

  if (input.batchRationale) {
    lines.push(
      '',
      'Planner rationale (intended sub-goal for this batch):',
      input.batchRationale,
    );
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
    '- Did this batch move closer to the phase goal compared to BEFORE? → ok (even if later phase-goal steps remain)',
    '- Is the full phase goal now satisfied in AFTER? → goal_reached',
    '- Did the batch fail, regress, or leave the page unchanged/worse with no useful progress? → fail',
    '',
    'Common ok cases:',
    '- Cookie banner or modal dismissed; main UI visible but search not done yet.',
    '- Destination typed or search submitted; results or confirmation still pending.',
    '',
    'Do NOT use fail when the batch clearly advanced (e.g. homepage → search results, cookie dismissed, modal closed, search re-submitted on results page) even if the phase goal lists more steps still pending.',
  );

  return lines.join('\n');
}
