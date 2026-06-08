import type { SlotAction } from '../../domain/schemas/generation-slots.schema.js';

export const GOTO_WAIT_UNTIL = 'domcontentloaded' as const;

/** Minimum settle time after navigation actions so SPAs can paint results. */
export const POST_ACTION_SETTLE_MS = 1000;

const STABILIZE_AFTER_ACTIONS: ReadonlySet<SlotAction> = new Set([
  'goto',
  'click',
  'press',
  'selectOption',
]);

export function shouldStabilizeAfterAction(action: SlotAction): boolean {
  return STABILIZE_AFTER_ACTIONS.has(action);
}

export function renderGotoCode(url: string): string {
  return `await page.goto(${JSON.stringify(url)}, { waitUntil: '${GOTO_WAIT_UNTIL}' });`;
}

export function renderPostStepStabilizationCode(indent = '  '): string {
  return [
    `${indent}await page.waitForLoadState('${GOTO_WAIT_UNTIL}').catch(() => undefined);`,
    `${indent}await page.waitForTimeout(${POST_ACTION_SETTLE_MS});`,
  ].join('\n');
}

export const FINAL_PAGE_STABILIZATION_CODE = renderPostStepStabilizationCode('  ');

export function renderCompiledStepLines(
  stepCode: string,
  action: SlotAction,
  stepId: number,
): string[] {
  const lines = [`  // @step id=${stepId}`, `  ${stepCode}`];

  if (shouldStabilizeAfterAction(action)) {
    lines.push(renderPostStepStabilizationCode('  '));
  }

  return lines;
}
