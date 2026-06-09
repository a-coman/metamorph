import type { SlotAction } from '../../domain/schemas/generation-slots.schema.js';
import type { InventoryItem } from '../../domain/schemas/page-snapshot.schema.js';

const FILLABLE_TAGS = new Set(['input', 'textarea', 'select']);
const FILLABLE_ROLES = new Set(['textbox', 'searchbox', 'combobox', 'spinbutton']);

export function isFillableInventoryItem(item: InventoryItem): boolean {
  const tag = item.tagName.toLowerCase();
  if (FILLABLE_TAGS.has(tag)) {
    return true;
  }
  const role = item.role?.toLowerCase();
  return role !== undefined && FILLABLE_ROLES.has(role);
}

/** Playwright fill with click+type fallback for custom combobox / div triggers (e.g. Airbnb). */
export function renderFillCode(targetExpr: string, value: string): string {
  const encoded = JSON.stringify(value);
  return `await (async () => {
    const __fillTarget = ${targetExpr};
    try {
      await __fillTarget.fill(${encoded});
    } catch {
      await __fillTarget.click();
      await page.keyboard.type(${encoded});
    }
  })()`;
}

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
  const lines = [
    `  // @step id=${stepId}`,
    ...stepCode.split('\n').map((line) => `  ${line}`),
  ];

  if (shouldStabilizeAfterAction(action)) {
    lines.push(renderPostStepStabilizationCode('  '));
  }

  return lines;
}
