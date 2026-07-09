import type { SlotAction, SlotStep } from '../../domain/schemas/generation-slots.schema.js';
import type { InventoryItem } from '../../domain/schemas/page-snapshot.schema.js';
import {
  GOTO_NAVIGATION_WAIT_UNTIL,
  renderPostStepStabilizationCode,
  renderFinalCaptureStabilizationCode,
} from './page-stabilization.js';

export {
  GOTO_NAVIGATION_WAIT_UNTIL,
  GOTO_WAIT_UNTIL,
  NETWORK_IDLE_WAIT_UNTIL,
  LOAD_STATE_TIMEOUT_MS,
  NETWORK_IDLE_LOAD_TIMEOUT_MS,
  POST_ACTION_SETTLE_MS,
} from './page-stabilization.js';

export {
  ADAPTIVE_SETTLE_INITIAL_MS,
  ADAPTIVE_SETTLE_POLL_MS,
  ADAPTIVE_SETTLE_MAX_MS_GOTO,
  ADAPTIVE_SETTLE_MAX_MS_ACTION,
  ADAPTIVE_SETTLE_MAX_MS_CAPTURE,
  PAGE_READY_MIN_BODY_TEXT,
  PAGE_READY_MAIN_TEXT_MIN,
  COLLECT_PAGE_READY_METRICS_BODY,
  assessPageReady,
  shouldStopAdaptiveSettle,
  getAdaptiveSettleMaxMs,
  renderAdaptiveSettleCode,
  renderFinalCaptureStabilizationCode,
  type StabilizePhase,
  type PageReadyMetrics,
} from './page-stabilization.js';

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

export function renderGotoCode(url: string): string {
  return `await page.goto(${JSON.stringify(url)}, { waitUntil: '${GOTO_NAVIGATION_WAIT_UNTIL}' });`;
}

const STABILIZE_AFTER_ACTIONS: ReadonlySet<SlotAction> = new Set([
  'goto',
  'click',
  'press',
  'selectOption',
]);

const INVENTORY_REFRESH_ACTIONS: ReadonlySet<SlotAction> = new Set([
  'goto',
  'click',
  'fill',
  'press',
  'scroll',
  'selectOption',
]);

export function shouldStabilizeAfterAction(action: SlotAction): boolean {
  return STABILIZE_AFTER_ACTIONS.has(action);
}

export function shouldRefreshInventoryAfterAction(action: SlotAction): boolean {
  return INVENTORY_REFRESH_ACTIONS.has(action);
}

export function shouldEndProbeBatchAfterStep(step: SlotStep): boolean {
  return shouldRefreshInventoryAfterAction(step.action);
}

/**
 * A planned batch is based on one inventory snapshot. Once a step can mutate
 * the DOM, URL, viewport, or focused widget state, later element_ids may be
 * stale. Execute through the first mutating step, then re-plan from a fresh
 * snapshot.
 */
export function trimProbeBatchAtMutatingStep(steps: SlotStep[]): SlotStep[] {
  const boundaryIndex = steps.findIndex(shouldEndProbeBatchAfterStep);
  if (boundaryIndex === -1) {
    return steps;
  }

  return steps.slice(0, boundaryIndex + 1);
}

export { renderPostStepStabilizationCode };

export const FINAL_PAGE_STABILIZATION_CODE = renderFinalCaptureStabilizationCode('  ');

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
    lines.push(renderPostStepStabilizationCode('  ', action));
  }

  return lines;
}
