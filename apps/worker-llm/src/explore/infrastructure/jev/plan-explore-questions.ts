import {
  isFillableInventoryItem,
  type InventoryItem,
  type MrIntent,
  type PageSnapshotInventory,
} from '@metamorph/core';
import type {
  ExploreBatchLog,
  ExplorePhase,
  ExploreSourceReference,
} from '../graph/explore-state.js';
import {
  JEV_ACTION_CANDIDATE_MAX,
  JEV_CHOICE_MAX,
  JEV_OVERLAY_CANDIDATE_MAX,
  NONE_CHOICE,
  SCROLL_DIRS,
} from './jev-plan-explore.constants.js';
import type { JevQuestion } from './openrouter-decisions.client.js';

export type CompactInventoryRow = {
  id: string;
  role: string;
  name: string;
  fillable: boolean;
};

export type CommittedStepRow = {
  action: string;
  element_id?: string;
  value?: string;
};

export type PageKind = 'home' | 'search_results' | 'other';

export type PlanExploreJevState = {
  url: string;
  page_kind: PageKind;
  phase: ExplorePhase;
  phase_goal: string;
  transform_family: string;
  last_committed: CommittedStepRow[];
  source_query: string | null;
  source_end_url: string | null;
  overlay_candidates: CompactInventoryRow[];
  controls: CompactInventoryRow[];
};

const OVERLAY_RE =
  /cookie|consent|aceptar|rechazar|accept all|reject all|reject|guardar|cerrar|privacy|gdpr|no.?thanks/i;
const FILTER_RE =
  /filter|filtro|marca|brand|precio|price|ordenar|sort|departamento|department|estrella|rating|prime|env[ií]o|checkbox/i;
const SEARCH_RE = /search|buscar|query|q\b/i;

export function capItemsByScore(
  items: InventoryItem[],
  max: number = JEV_CHOICE_MAX,
): InventoryItem[] {
  if (items.length <= max) {
    return items;
  }

  return [...items]
    .sort((left, right) => right.score - left.score)
    .slice(0, max);
}

export function isSelectOptionInventoryItem(item: InventoryItem): boolean {
  if (!item.options || item.options.length === 0) {
    return false;
  }

  if (item.tagName.toLowerCase() === 'select') {
    return true;
  }

  return item.role?.toLowerCase() === 'combobox';
}

export function itemHaystack(item: InventoryItem): string {
  return [item.name, item.ariaLabel, item.textPreview, item.role]
    .filter((value): value is string => Boolean(value))
    .join(' ');
}

export function isOverlayCandidate(item: InventoryItem): boolean {
  const role = item.role?.toLowerCase() ?? '';
  if (role === 'dialog' || role === 'alertdialog') {
    return true;
  }
  if (!OVERLAY_RE.test(itemHaystack(item))) {
    return false;
  }
  const tag = item.tagName.toLowerCase();
  return tag === 'button' || tag === 'a' || role === 'button' || role === 'link';
}

export function isSearchishItem(item: InventoryItem): boolean {
  const role = item.role?.toLowerCase() ?? '';
  if (role === 'searchbox') {
    return true;
  }
  return isFillableInventoryItem(item) && SEARCH_RE.test(itemHaystack(item));
}

export function isActionCandidate(item: InventoryItem): boolean {
  if (isFillableInventoryItem(item) || isSelectOptionInventoryItem(item) || isOverlayCandidate(item)) {
    return true;
  }

  const role = item.role?.toLowerCase() ?? '';
  const tag = item.tagName.toLowerCase();
  if (
    role === 'button' ||
    role === 'checkbox' ||
    role === 'radio' ||
    role === 'switch' ||
    role === 'tab' ||
    role === 'searchbox' ||
    tag === 'button' ||
    tag === 'input' ||
    tag === 'select' ||
    tag === 'textarea'
  ) {
    return true;
  }

  if (item.labelShown && role !== 'link') {
    return true;
  }

  return item.labelShown && role === 'link' && FILTER_RE.test(itemHaystack(item));
}

export function itemCriteriaLine(item: InventoryItem): string {
  const role = item.role ?? item.tagName;
  const label = item.name || item.ariaLabel || item.textPreview || item.shortId;
  const kind = isFillableInventoryItem(item)
    ? 'fillable'
    : isSelectOptionInventoryItem(item)
      ? 'select'
      : 'click';
  return `${role} ${JSON.stringify(label)} (${kind})`;
}

export function toCompactInventoryRow(item: InventoryItem): CompactInventoryRow {
  return {
    id: item.shortId,
    role: item.role ?? item.tagName,
    name: item.name || item.ariaLabel || item.textPreview || item.shortId,
    fillable: isFillableInventoryItem(item),
  };
}

export function pickOverlayCandidates(items: InventoryItem[]): InventoryItem[] {
  return capItemsByScore(
    items.filter(isOverlayCandidate),
    JEV_OVERLAY_CANDIDATE_MAX,
  );
}

export function pickActionCandidates(items: InventoryItem[]): InventoryItem[] {
  const overlays = pickOverlayCandidates(items);
  const rest = items.filter(
    (item) => isActionCandidate(item) && !overlays.some((overlay) => overlay.shortId === item.shortId),
  );
  const picked = [...overlays, ...capItemsByScore(rest, JEV_ACTION_CANDIDATE_MAX - overlays.length)];
  if (picked.length > 0) {
    return picked.slice(0, JEV_ACTION_CANDIDATE_MAX);
  }
  return capItemsByScore(items, Math.min(20, JEV_ACTION_CANDIDATE_MAX));
}

export function pageKindFromUrl(url: string): PageKind {
  try {
    const parsed = new URL(url);
    const pathAndQuery = `${parsed.pathname}${parsed.search}`;
    if (/\/s(\/|\?|$)/.test(pathAndQuery) || parsed.searchParams.has('k')) {
      return 'search_results';
    }
    if (parsed.pathname === '/' || parsed.pathname === '') {
      return 'home';
    }
  } catch {
    // keep other
  }
  return 'other';
}

export function compactCommittedSteps(
  batchLog: ExploreBatchLog,
  phase: ExplorePhase,
): CommittedStepRow[] {
  return batchLog[phase]
    .filter((record) => record.outcome === 'committed')
    .flatMap((record) => record.steps)
    .slice(-6)
    .map((step) => {
      const row: CommittedStepRow = { action: step.action };
      if (step.element_id) {
        row.element_id = step.element_id;
      }
      if (step.value) {
        row.value = step.value;
      }
      return row;
    });
}

export function extractLastFillValue(
  batchLog: ExploreBatchLog,
  phase: ExplorePhase,
): string | null {
  for (const record of [...batchLog[phase]].reverse()) {
    if (record.outcome !== 'committed') {
      continue;
    }
    for (const step of [...record.steps].reverse()) {
      const value = step.value?.trim();
      if (step.action === 'fill' && value) {
        return value;
      }
    }
  }
  return null;
}

export function extractSourceQuery(input: {
  batchLog: ExploreBatchLog;
  sourceReference?: ExploreSourceReference;
}): string | null {
  const fromSource = extractLastFillValue(input.batchLog, 'source');
  if (fromSource) {
    return fromSource;
  }

  for (const line of [...(input.sourceReference?.exploredSteps ?? [])].reverse()) {
    const match = line.match(/with "([^"]+)"/);
    if (match?.[1]) {
      return match[1];
    }
  }

  return null;
}

function buildChoiceCriteria(items: InventoryItem[]): Record<string, string> {
  const criteria: Record<string, string> = { [NONE_CHOICE]: 'None of these controls.' };
  for (const item of items) {
    criteria[item.shortId] = itemCriteriaLine(item);
  }
  return criteria;
}

export function buildPlanExploreJevRequest(input: {
  url: string;
  phase: ExplorePhase;
  mrIntent: MrIntent;
  inventory: PageSnapshotInventory;
  batchLog: ExploreBatchLog;
  sourceReference?: ExploreSourceReference;
}): {
  state: PlanExploreJevState;
  questions: Record<string, JevQuestion>;
} {
  const phaseGoal =
    input.phase === 'source'
      ? input.mrIntent.exploration.source_phase_goal
      : input.mrIntent.exploration.follow_up_phase_goal;
  const overlayItems = pickOverlayCandidates(input.inventory.items);
  const controlItems = pickActionCandidates(input.inventory.items);
  const sourceQuery = extractSourceQuery(input);

  const state: PlanExploreJevState = {
    url: input.url,
    page_kind: pageKindFromUrl(input.url),
    phase: input.phase,
    phase_goal: phaseGoal,
    transform_family: input.mrIntent.mr_definition.transformation.transform_family,
    last_committed: compactCommittedSteps(input.batchLog, input.phase),
    source_query: sourceQuery,
    source_end_url: input.sourceReference?.endUrl ?? null,
    overlay_candidates: overlayItems.map(toCompactInventoryRow),
    controls: controlItems.map(toCompactInventoryRow),
  };

  const questions: Record<string, JevQuestion> = {
    goal_already_met: {
      type: 'noul',
      instructions:
        'Does the page at `url` already satisfy `phase_goal`, given `page_kind`, `controls`, and `last_committed`?',
      criteria: {
        true: 'The phase goal is already done. No further click or fill is needed.',
        false: 'At least one more interaction is still required for `phase_goal`.',
      },
    },
    permanently_blocked: {
      type: 'noul',
      instructions:
        'Is `phase_goal` permanently blocked by a login wall or captcha on this page?',
      criteria: {
        true: 'Login or captcha with no guest path.',
        false: 'The goal is still reachable without an account.',
      },
    },
    blocked_by: {
      type: 'choice',
      instructions: 'If the goal is permanently blocked, what blocks `phase_goal`?',
      criteria: {
        none: 'The goal is not permanently blocked.',
        login: 'A sign-in or account wall with no guest path.',
        captcha: 'A captcha or bot check.',
        impossible: 'This page cannot support the metamorphic relation.',
      },
    },
    overlay_present: {
      type: 'noul',
      instructions:
        'Does `overlay_candidates` still show a cookie or consent dialog covering the page?',
      criteria: {
        true: 'A cookie or consent overlay is still blocking the page.',
        false: 'No cookie or consent overlay is blocking the page.',
      },
    },
    overlay_target: {
      type: 'choice',
      instructions:
        'Which id in `overlay_candidates` dismisses the cookie or consent dialog?',
      criteria: buildChoiceCriteria(overlayItems),
    },
    next_control: {
      type: 'choice',
      instructions:
        'Which id in `controls` is the next control to use for `phase_goal`? Prefer a search box when `page_kind` is home and `phase_goal` requires a search. Prefer a filter control when `page_kind` is search_results.',
      criteria: buildChoiceCriteria(controlItems),
    },
    control_missing: {
      type: 'noul',
      instructions:
        'Is the control required by `phase_goal` missing from `controls`, so the page should scroll?',
      criteria: {
        true: 'The needed control is below or above the current viewport.',
        false: 'A suitable control is already listed in `controls`.',
      },
    },
    scroll_dir: {
      type: 'choice',
      instructions:
        'If the page should scroll to reveal a control for `phase_goal`, which direction?',
      criteria: {
        down: 'The needed control is below the current viewport.',
        up: 'The needed control is above the current viewport, such as the search bar.',
      },
    },
    page_settling: {
      type: 'noul',
      instructions:
        'Is the page still hydrating or animating, so a short wait should run before the next click or fill?',
      criteria: {
        true: 'An overlay animation, combobox, or lazy content is not ready.',
        false: 'The page is ready for the next action.',
      },
    },
  };

  return { state, questions };
}

export function buildSelectOptionQuestions(
  item: InventoryItem,
): Record<string, JevQuestion> {
  const options = (item.options ?? []).slice(0, JEV_CHOICE_MAX);
  const criteria: Record<string, string> = {};
  for (const option of options) {
    const value = option.value.length > 0 ? option.value : option.label;
    if (!value || criteria[value]) {
      continue;
    }
    criteria[value] = option.label || option.value;
  }

  return {
    select_value: {
      type: 'choice',
      instructions: `Which option value should be selected on ${item.shortId} (${itemCriteriaLine(item)})? The value must match inventory options exactly.`,
      criteria,
    },
  };
}

export function buildSelectOptionState(
  item: InventoryItem,
  planState: PlanExploreJevState,
): unknown {
  return {
    url: planState.url,
    phase: planState.phase,
    phase_goal: planState.phase_goal,
    target: toCompactInventoryRow(item),
  };
}

export const SCROLL_DIR_SET = new Set<string>(SCROLL_DIRS);
