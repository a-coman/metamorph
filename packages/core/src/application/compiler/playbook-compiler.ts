import { createHash } from 'node:crypto';
import type { GenerationSlots, SlotStep } from '../../domain/schemas/generation-slots.schema.js';
import type { MrDefinition } from '../../domain/schemas/mr-definition.schema.js';
import type { InventoryItem, PageSnapshotInventory } from '../../domain/schemas/page-snapshot.schema.js';
import {
  PLAYBOOK_TEMPLATE_VERSION,
  renderObservationSchema,
  renderPlaybook,
} from '../../infrastructure/templates/playbook-template.v1.js';
import {
  renderCompiledStepLines,
  renderFillCode,
  renderComboboxFillCode,
  isComboboxInventoryItem,
  renderGotoCode,
} from './step-execution-policy.js';
import { withProbeGotoPrefix } from './probe-spec-compiler.js';
import { resolveStepTargetExpression } from './resolve-inventory-target.js';

export type CompilePlaybookResult = {
  playbookContent: string;
  schemaContent: string;
  contentHash: string;
  templateVersion: string;
};

export class PlaybookCompileError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PlaybookCompileError';
  }
}

export function compilePlaybook(
  slots: GenerationSlots,
  _mrDefinition: MrDefinition,
  inventory: PageSnapshotInventory,
  options?: { sessionUrl?: string },
): CompilePlaybookResult {
  const itemMap = new Map(inventory.items.map((item) => [item.shortId, item]));

  validateElementIds(slots, itemMap);

  const sessionUrl = options?.sessionUrl;
  const sourceSteps =
    sessionUrl !== undefined
      ? withProbeGotoPrefix(slots.source.steps, sessionUrl)
      : slots.source.steps;
  const followUpSteps =
    sessionUrl !== undefined
      ? withProbeGotoPrefix(slots.follow_up.steps, sessionUrl)
      : slots.follow_up.steps;

  const sourceStepLines = renderScenarioSteps(sourceSteps, itemMap);
  const followUpStepLines = renderScenarioSteps(followUpSteps, itemMap);

  const playbookContent = renderPlaybook({
    observationFields: slots.observation.fields,
    sourceStepLines,
    followUpStepLines,
  });

  const schemaContent = renderObservationSchema(slots.observation.fields);
  const contentHash = createHash('sha256').update(playbookContent).digest('hex');

  return {
    playbookContent,
    schemaContent,
    contentHash,
    templateVersion: PLAYBOOK_TEMPLATE_VERSION,
  };
}

function validateElementIds(
  slots: GenerationSlots,
  itemMap: Map<string, InventoryItem>,
): void {
  const allSteps = [...slots.source.steps, ...slots.follow_up.steps];

  for (const step of allSteps) {
    if (step.resolved_locator || step.resolved_selector) {
      continue;
    }

    if (!step.element_id) {
      continue;
    }

    if (!itemMap.has(step.element_id)) {
      throw new PlaybookCompileError(
        `element_id ${step.element_id} not found in inventory`,
      );
    }
  }
}

function renderScenarioSteps(
  steps: SlotStep[],
  itemMap: Map<string, InventoryItem>,
): string[] {
  return steps.flatMap((step) => {
    const code = renderStepCode(step, itemMap);
    return renderCompiledStepLines(code, step.action, step.id);
  });
}

function renderStepCode(
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
      const item = step.element_id ? itemMap.get(step.element_id) : undefined;
      return item && isComboboxInventoryItem(item)
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

function resolveTarget(
  step: SlotStep,
  itemMap: Map<string, InventoryItem>,
): string {
  return resolveStepTargetExpression(step, itemMap);
}

export function validateInventoryElementIds(
  slots: GenerationSlots,
  inventory: PageSnapshotInventory,
): string[] {
  const itemIds = new Set(inventory.items.map((item) => item.shortId));
  const missing: string[] = [];

  for (const step of [...slots.source.steps, ...slots.follow_up.steps]) {
    if (step.element_id && !itemIds.has(step.element_id)) {
      missing.push(step.element_id);
    }
  }

  return missing;
}

export function extractHostFromUrl(url: string): string {
  return new URL(url).hostname.replace(/^www\./, '');
}
