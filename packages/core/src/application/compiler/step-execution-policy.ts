import type { SlotAction, SlotStep } from '../../domain/schemas/generation-slots.schema.js';
import type { InventoryItem } from '../../domain/schemas/page-snapshot.schema.js';

export type FillBehavior = 'plain' | 'autocomplete';

export function resolveStepFillBehavior(step: SlotStep): FillBehavior {
  return step.fill_behavior === 'autocomplete' ? 'autocomplete' : 'plain';
}

const FILLABLE_TAGS = new Set(['input', 'textarea']);
const FILLABLE_ROLES = new Set(['textbox', 'searchbox', 'combobox', 'spinbutton']);

export function isFillableInventoryItem(item: InventoryItem): boolean {
  const tag = item.tagName.toLowerCase();
  // Native <select> uses selectOption, not fill.
  if (tag === 'select') {
    return false;
  }
  if (FILLABLE_TAGS.has(tag)) {
    return true;
  }
  const role = item.role?.toLowerCase();
  return role !== undefined && FILLABLE_ROLES.has(role);
}

/** Custom combobox/searchbox targets that need autocomplete fill — not native <select>. */
export function isComboboxInventoryItem(item: InventoryItem): boolean {
  const tag = item.tagName.toLowerCase();
  if (tag === 'select') {
    return false;
  }

  const role = item.role?.toLowerCase();
  return role === 'combobox' || role === 'searchbox';
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

/** Fill combobox/searchbox targets and select a matching autocomplete suggestion when present. */
export function renderComboboxFillCode(targetExpr: string, value: string): string {
  const encoded = JSON.stringify(value);
  const pattern = JSON.stringify(value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  return `await (async () => {
    const __fillTarget = ${targetExpr};
    try {
      await __fillTarget.fill(${encoded});
    } catch {
      await __fillTarget.click();
      await page.keyboard.type(${encoded});
    }
    await page.waitForTimeout(400);
    const __namePattern = new RegExp(${pattern}, 'i');
    const __optionCandidates = [
      page.getByRole('option', { name: __namePattern }).first(),
      page.locator('[role="listbox"] [role="option"]').filter({ hasText: __namePattern }).first(),
      page.locator('[role="option"]').filter({ hasText: __namePattern }).first(),
    ];
    for (const __option of __optionCandidates) {
      const __visible = await __option.isVisible({ timeout: 2500 }).catch(() => false);
      if (__visible) {
        await __option.click();
        return;
      }
    }
    await page.keyboard.press('ArrowDown');
    await page.waitForTimeout(200);
    await page.keyboard.press('Enter');
  })()`;
}

export const GOTO_WAIT_UNTIL = 'domcontentloaded' as const;
export const NETWORK_IDLE_WAIT_UNTIL = 'networkidle' as const;

/** Cap domcontentloaded waits — SPAs may not reach it promptly. */
export const LOAD_STATE_TIMEOUT_MS = 5000;

/** Shorter cap for networkidle — SPAs often never go fully idle. */
export const NETWORK_IDLE_LOAD_TIMEOUT_MS = 2000;

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
    `${indent}await page.waitForLoadState('${GOTO_WAIT_UNTIL}', { timeout: ${LOAD_STATE_TIMEOUT_MS} }).catch(() => undefined);`,
    `${indent}await page.waitForLoadState('${NETWORK_IDLE_WAIT_UNTIL}', { timeout: ${NETWORK_IDLE_LOAD_TIMEOUT_MS} }).catch(() => undefined);`,
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
