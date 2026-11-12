import {
  ExplorePlanOutputSchema,
  isFillableInventoryItem,
  type ExplorePlanOutput,
  type InventoryItem,
  type SlotStep,
} from '@metamorph/core';
import {
  JEV_MIN_CONFIDENCE,
  JEV_NOUL_BLOCKED,
  JEV_NOUL_GOAL_MET,
  JEV_NOUL_OVERLAY,
  JEV_NOUL_SCROLL,
  JEV_SCROLL_DOWN_PX,
  JEV_SCROLL_UP_PX,
  JEV_WAIT_FIRST_THRESHOLD,
  JEV_WAIT_PREFIX_MS,
  NONE_CHOICE,
} from './jev-plan-explore.constants.js';
import type { JevAnswer, JevChoiceAnswer } from './openrouter-decisions.client.js';
import { asChoiceAnswer, asNoulAnswer } from './openrouter-decisions.client.js';
import {
  isSelectOptionInventoryItem,
  SCROLL_DIR_SET,
} from './plan-explore-questions.js';
import { synthesizePlanRationale } from './synthesize-plan-rationale.js';

export class JevPlanAssemblyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'JevPlanAssemblyError';
  }
}

export type AssemblePlanExploreInput = {
  answers: Record<string, JevAnswer>;
  inventoryById: Map<string, InventoryItem>;
  nextStepId: number;
  fillValue?: string;
  selectValue?: string;
};

function noulValue(answers: Record<string, JevAnswer>, key: string): number {
  return asNoulAnswer(answers, key)?.noul ?? 0;
}

function optionalChoice(
  answers: Record<string, JevAnswer>,
  key: string,
): JevChoiceAnswer | undefined {
  return asChoiceAnswer(answers, key);
}

function parsePlan(output: ExplorePlanOutput): ExplorePlanOutput {
  const parsed = ExplorePlanOutputSchema.safeParse(output);
  if (!parsed.success || parsed.data === undefined) {
    throw new JevPlanAssemblyError(
      parsed.error?.message ?? 'Assembled plan failed schema validation',
    );
  }
  return parsed.data;
}

function withWaitPrefix(
  answers: Record<string, JevAnswer>,
  nextId: number,
  mutating: SlotStep,
): SlotStep[] {
  const settling = noulValue(answers, 'page_settling');
  if (settling < JEV_WAIT_FIRST_THRESHOLD) {
    return [mutating];
  }
  return [
    { id: nextId, action: 'waitFor', timeout_ms: JEV_WAIT_PREFIX_MS },
    { ...mutating, id: nextId + 1 },
  ];
}

function abortPlan(
  answers: Record<string, JevAnswer>,
  inventoryById: Map<string, InventoryItem>,
): ExplorePlanOutput {
  const blockedBy = optionalChoice(answers, 'blocked_by')?.choice;
  const abortReason =
    blockedBy === 'login'
      ? 'auth_wall'
      : blockedBy === 'captcha'
        ? 'captcha'
        : blockedBy === 'impossible'
          ? 'impossible_mr'
          : 'other';
  return parsePlan({
    action: 'abort',
    rationale: synthesizePlanRationale({
      action: 'abort',
      abortReason,
      inventoryById,
    }),
  });
}

function completePlan(inventoryById: Map<string, InventoryItem>): ExplorePlanOutput {
  return parsePlan({
    action: 'scenario_complete',
    rationale: synthesizePlanRationale({
      action: 'scenario_complete',
      inventoryById,
    }),
  });
}

function appendSteps(
  answers: Record<string, JevAnswer>,
  inventoryById: Map<string, InventoryItem>,
  nextStepId: number,
  mutating: SlotStep,
): ExplorePlanOutput {
  const steps = withWaitPrefix(answers, nextStepId, mutating);
  return parsePlan({
    action: 'append_steps',
    steps,
    rationale: synthesizePlanRationale({
      action: 'append_steps',
      steps,
      inventoryById,
    }),
  });
}

function stepFromItem(input: {
  item: InventoryItem;
  id: number;
  fillValue?: string;
  selectValue?: string;
}): SlotStep {
  if (isFillableInventoryItem(input.item)) {
    const value = input.fillValue?.trim() ?? '';
    if (!value) {
      throw new JevPlanAssemblyError(`Missing fill value for ${input.item.shortId}`);
    }
    return {
      id: input.id,
      action: 'fill',
      element_id: input.item.shortId,
      value,
    };
  }

  if (isSelectOptionInventoryItem(input.item)) {
    const value = input.selectValue?.trim() ?? '';
    if (!value) {
      throw new JevPlanAssemblyError(`Missing selectOption value for ${input.item.shortId}`);
    }
    return {
      id: input.id,
      action: 'selectOption',
      element_id: input.item.shortId,
      value,
    };
  }

  return { id: input.id, action: 'click', element_id: input.item.shortId };
}

function resolveControlId(
  answers: Record<string, JevAnswer>,
  key: string,
  inventoryById: Map<string, InventoryItem>,
): string | undefined {
  const answer = optionalChoice(answers, key);
  if (!answer || answer.choice === NONE_CHOICE) {
    return undefined;
  }
  if (!inventoryById.has(answer.choice)) {
    return undefined;
  }
  return answer.choice;
}

export function assemblePlanExplore(input: AssemblePlanExploreInput): ExplorePlanOutput {
  if (noulValue(input.answers, 'permanently_blocked') >= JEV_NOUL_BLOCKED) {
    return abortPlan(input.answers, input.inventoryById);
  }

  const overlayId = resolveControlId(input.answers, 'overlay_target', input.inventoryById);
  if (noulValue(input.answers, 'overlay_present') >= JEV_NOUL_OVERLAY && overlayId) {
    const overlay = input.inventoryById.get(overlayId)!;
    return appendSteps(
      input.answers,
      input.inventoryById,
      input.nextStepId,
      { id: input.nextStepId, action: 'click', element_id: overlay.shortId },
    );
  }

  if (noulValue(input.answers, 'goal_already_met') >= JEV_NOUL_GOAL_MET) {
    return completePlan(input.inventoryById);
  }

  const nextId = resolveControlId(input.answers, 'next_control', input.inventoryById);
  const nextAnswer = optionalChoice(input.answers, 'next_control');
  const nextConfidence =
    typeof nextAnswer?.confidence === 'number' ? nextAnswer.confidence : 1;
  const canTrustNext = Boolean(nextId) && nextConfidence >= JEV_MIN_CONFIDENCE;

  if (canTrustNext && nextId) {
    const item = input.inventoryById.get(nextId)!;
    return appendSteps(
      input.answers,
      input.inventoryById,
      input.nextStepId,
      stepFromItem({
        item,
        id: input.nextStepId,
        fillValue: input.fillValue,
        selectValue: input.selectValue,
      }),
    );
  }

  if (noulValue(input.answers, 'control_missing') >= JEV_NOUL_SCROLL) {
    const dir = optionalChoice(input.answers, 'scroll_dir')?.choice ?? 'down';
    if (!SCROLL_DIR_SET.has(dir)) {
      throw new JevPlanAssemblyError(`Unknown scroll_dir ${dir}`);
    }
    return appendSteps(
      input.answers,
      input.inventoryById,
      input.nextStepId,
      {
        id: input.nextStepId,
        action: 'scroll',
        scroll_y: dir === 'up' ? JEV_SCROLL_UP_PX : JEV_SCROLL_DOWN_PX,
      },
    );
  }

  if (nextId) {
    const item = input.inventoryById.get(nextId)!;
    return appendSteps(
      input.answers,
      input.inventoryById,
      input.nextStepId,
      stepFromItem({
        item,
        id: input.nextStepId,
        fillValue: input.fillValue,
        selectValue: input.selectValue,
      }),
    );
  }

  throw new JevPlanAssemblyError(
    `No actionable control (next_control=${nextAnswer?.choice ?? 'missing'} confidence=${nextAnswer?.confidence ?? 'n/a'})`,
  );
}
