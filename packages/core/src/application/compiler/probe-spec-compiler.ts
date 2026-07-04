import type { SlotStep } from '../../domain/schemas/generation-slots.schema.js';
import type { InventoryItem, PageSnapshotInventory } from '../../domain/schemas/page-snapshot.schema.js';
import { PlaybookCompileError } from './playbook-compiler.js';
import {
  applyResolvedTargetToStep,
  resolveInventoryItemTarget,
  resolveStepTargetExpression,
} from './resolve-inventory-target.js';
import {
  renderCompiledStepLines,
  renderFillCode,
  renderComboboxFillCode,
  isComboboxInventoryItem,
  resolveStepFillBehavior,
  renderGotoCode,
} from './step-execution-policy.js';

export type CompileProbeSpecResult = {
  playbookContent: string;
};

/**
 * Attaches the resolved Playwright target (locator chain or CSS selector) to
 * each step using the inventory that was active when the step was planned.
 * This makes the step self-contained so later replays do not depend on
 * snapshot-specific shortIds (element_id), which are reassigned per page.
 */
export function resolveStepTargets(
  steps: SlotStep[],
  inventory: PageSnapshotInventory,
): SlotStep[] {
  const itemMap = new Map(inventory.items.map((item) => [item.shortId, item]));

  return steps.map((step) => {
    if (!step.element_id || !['click', 'fill', 'selectOption'].includes(step.action)) {
      return step;
    }

    const item = itemMap.get(step.element_id);
    if (!item) {
      if (step.action === 'fill') {
        return { ...step, fill_behavior: 'plain' as const };
      }
      return step;
    }

    const withTarget = applyResolvedTargetToStep(
      step,
      resolveInventoryItemTarget(item),
    );

    if (step.action !== 'fill') {
      return withTarget;
    }

    return {
      ...withTarget,
      fill_behavior: isComboboxInventoryItem(item) ? 'autocomplete' : 'plain',
    };
  });
}

export function withProbeGotoPrefix(steps: SlotStep[], startUrl: string): SlotStep[] {
  if (steps.length === 0) {
    return [{ id: 1, action: 'goto', url: startUrl }];
  }

  if (steps[0]?.action === 'goto') {
    return steps;
  }

  const renumbered = steps.map((step, index) => ({
    ...step,
    id: index + 2,
  }));

  return [{ id: 1, action: 'goto', url: startUrl }, ...renumbered];
}

export function compileProbeSpec(
  steps: SlotStep[],
  inventory: PageSnapshotInventory,
  options?: { startUrl?: string },
): CompileProbeSpecResult {
  const resolvedSteps = options?.startUrl
    ? withProbeGotoPrefix(steps, options.startUrl)
    : steps;

  const itemMap = new Map(inventory.items.map((item) => [item.shortId, item]));

  for (const step of resolvedSteps) {
    if (hasResolvedTarget(step)) {
      continue;
    }

    if (step.element_id && !itemMap.has(step.element_id)) {
      throw new PlaybookCompileError(
        `element_id ${step.element_id} not found in inventory`,
      );
    }
  }

  const stepLines = resolvedSteps.flatMap((step) => {
    const code = renderProbeStepCode(step, itemMap);
    return renderCompiledStepLines(code, step.action, step.id);
  });

  const playbookContent = renderProbePlaybook(stepLines);

  return { playbookContent };
}

function renderProbePlaybook(stepLines: string[]): string {
  const steps = stepLines.join('\n');

  return `import { test } from '@playwright/test';
import { writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __probeDir = dirname(fileURLToPath(import.meta.url));

test('probe', async ({ page }) => {
${steps}
  writeFileSync(join(__probeDir, 'final-url.txt'), page.url());
});
`;
}

function renderProbeStepCode(
  step: SlotStep,
  itemMap: Map<string, InventoryItem>,
): string {
  switch (step.action) {
    case 'goto':
      if (!step.url) {
        throw new PlaybookCompileError(`Step ${step.id}: goto requires url`);
      }
      return renderGotoCode(step.url);

    case 'click': {
      const target = resolveTarget(step, itemMap);
      return `await ${target}.click();`;
    }

    case 'fill': {
      const target = resolveTarget(step, itemMap);
      return resolveStepFillBehavior(step) === 'autocomplete'
        ? renderComboboxFillCode(target, step.value ?? '')
        : renderFillCode(target, step.value ?? '');
    }

    case 'selectOption': {
      const target = resolveTarget(step, itemMap);
      return `await ${target}.selectOption(${JSON.stringify(step.value ?? '')});`;
    }

    case 'press':
      return `await page.keyboard.press(${JSON.stringify(step.key ?? 'Enter')});`;

    case 'scroll':
      return `await page.evaluate(() => window.scrollBy(0, ${step.scroll_y ?? 500}));`;

    case 'waitFor':
      return `await page.waitForTimeout(${step.timeout_ms ?? 2000});`;

    default:
      throw new PlaybookCompileError(`Unsupported action: ${step.action}`);
  }
}

function hasResolvedTarget(step: SlotStep): boolean {
  return Boolean(step.resolved_locator || step.resolved_selector);
}

function resolveTarget(
  step: SlotStep,
  itemMap: Map<string, InventoryItem>,
): string {
  return resolveStepTargetExpression(step, itemMap);
}
