import type {
  ExplorationCheckpointDto,
  LlmCallDto,
  ProbeStatusDto,
  ScreenshotDto,
} from '@metamorph/api-client';
import {
  activitySortAtCheckpoint,
  activitySortAtLlm,
  activitySortAtProbe,
  activitySortAtScreenshot,
  compareActivityTimeline,
  timelineSortKeyForCycleStep,
  timelineSortKeyForStandalone,
  type TimelineStepKind,
} from './activity-feed';

export type ExplorationPhase = 'source' | 'follow_up';

export type ExplorationCycleKind =
  | 'incremental'
  | 'goal_complete'
  | 'smoke'
  | 'plan_recovery';

export type ExplorationCycle = {
  id: string;
  kind: ExplorationCycleKind;
  sortAt: number;
  phase: ExplorationPhase | null;
  plan?: LlmCallDto;
  probe?: ProbeStatusDto;
  verify?: LlmCallDto;
  checkpoint?: ExplorationCheckpointDto;
  verifySkipped?: 'probe_failed' | 'graph_interrupted';
};

export type StandaloneActivity =
  | { type: 'llm'; llm: LlmCallDto; checkpoint?: ExplorationCheckpointDto }
  | { type: 'compile'; record: LlmCallDto }
  | { type: 'session_capture'; screenshot: ScreenshotDto }
  | { type: 'checkpoint_orphan'; checkpoint: ExplorationCheckpointDto };

export type TimelineFeedItem =
  | { kind: 'cycle_step'; cycle: ExplorationCycle; step: TimelineStepKind }
  | { kind: 'standalone'; item: StandaloneActivity }
  | { kind: 'phase_divider'; phase: ExplorationPhase };

type CycleStepFeedItem = Extract<TimelineFeedItem, { kind: 'cycle_step' }>;

/** @deprecated Use TimelineFeedItem */
export type CycleFeedItem = TimelineFeedItem;

import type { TerminalExploreJobStatus } from './activity-status';

export type ExplorationActivityInput = {
  llmCalls: Map<string, LlmCallDto>;
  probes: Map<string, ProbeStatusDto>;
  screenshots: Map<string, ScreenshotDto>;
  checkpoints: Map<string, ExplorationCheckpointDto>;
  terminalExploreJobs?: Map<string, TerminalExploreJobStatus>;
};

const PLAN_PURPOSES = new Set(['plan_explore', 'explore_plan']);

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function getPlanAction(llm: LlmCallDto): string | null {
  const action = asRecord(llm.responseJson)?.action;
  return typeof action === 'string' ? action : null;
}

function normalizePhase(value: string | null | undefined): ExplorationPhase | null {
  if (value === 'source' || value === 'follow_up') return value;
  return null;
}

function sortedLlms(llmCalls: Map<string, LlmCallDto>, predicate: (llm: LlmCallDto) => boolean) {
  return [...llmCalls.values()]
    .filter(predicate)
    .sort((a, b) => activitySortAtLlm(a) - activitySortAtLlm(b));
}

function sortedProbes(probes: Map<string, ProbeStatusDto>) {
  return [...probes.values()].sort((a, b) => activitySortAtProbe(a) - activitySortAtProbe(b));
}

function findPlanForProbe(
  probe: ProbeStatusDto,
  plans: LlmCallDto[],
  usedPlanIds: Set<string>,
): LlmCallDto | undefined {
  if (probe.planLlmCallId) {
    const linked = plans.find((plan) => plan.id === probe.planLlmCallId);
    if (linked) return linked;
  }

  const probeAt = activitySortAtProbe(probe);
  let candidate: LlmCallDto | undefined;
  for (const plan of plans) {
    if (usedPlanIds.has(plan.id)) continue;
    if (activitySortAtLlm(plan) > probeAt) break;
    if (getPlanAction(plan) === 'append_steps') {
      candidate = plan;
    }
  }
  return candidate;
}

function findVerifyForProbe(
  probe: ProbeStatusDto,
  verifyLlms: LlmCallDto[],
  checkpointByLlmId: Map<string, ExplorationCheckpointDto>,
  usedVerifyIds: Set<string>,
  nextPlanAt: number | null,
): { verify?: LlmCallDto; checkpoint?: ExplorationCheckpointDto } {
  const probeDoneAt = new Date(probe.updatedAt).getTime();

  for (const verify of verifyLlms) {
    if (usedVerifyIds.has(verify.id)) continue;
    const verifyAt = activitySortAtLlm(verify);
    if (verifyAt < probeDoneAt) continue;
    if (nextPlanAt !== null && verifyAt > nextPlanAt) continue;
    return {
      verify,
      checkpoint: checkpointByLlmId.get(verify.id),
    };
  }

  return {};
}

function findNextPlanAt(plans: LlmCallDto[], afterAt: number): number | null {
  for (const plan of plans) {
    const at = activitySortAtLlm(plan);
    if (at > afterAt) return at;
  }
  return null;
}

function findScenarioCompletePlanForSmoke(
  probe: ProbeStatusDto,
  plans: LlmCallDto[],
): LlmCallDto | undefined {
  if (probe.planLlmCallId) {
    const linked = plans.find((plan) => plan.id === probe.planLlmCallId);
    if (linked && getPlanAction(linked) === 'scenario_complete') return linked;
  }

  const probeAt = activitySortAtProbe(probe);
  let candidate: LlmCallDto | undefined;
  for (const plan of plans) {
    if (activitySortAtLlm(plan) > probeAt) break;
    if (getPlanAction(plan) === 'scenario_complete') {
      candidate = plan;
    }
  }
  return candidate;
}

export function buildExplorationCycles(input: ExplorationActivityInput): {
  cycles: ExplorationCycle[];
  standalone: StandaloneActivity[];
} {
  const checkpointByLlmId = new Map<string, ExplorationCheckpointDto>();
  const attachedCheckpointIds = new Set<string>();

  for (const checkpoint of input.checkpoints.values()) {
    if (checkpoint.llmCallId) {
      checkpointByLlmId.set(checkpoint.llmCallId, checkpoint);
    }
  }

  const plans = sortedLlms(input.llmCalls, (llm) => PLAN_PURPOSES.has(llm.purpose));
  const verifyLlms = sortedLlms(input.llmCalls, (llm) => llm.purpose === 'explore_verify');
  const probes = sortedProbes(input.probes);

  const usedPlanIds = new Set<string>();
  const usedProbeIds = new Set<string>();
  const usedVerifyIds = new Set<string>();
  const cycles: ExplorationCycle[] = [];

  for (const probe of probes) {
    if (usedProbeIds.has(probe.jobId)) continue;

    if (probe.mode === 'smoke_replay') {
      usedProbeIds.add(probe.jobId);
      const linkedPlan = findScenarioCompletePlanForSmoke(probe, plans);
      if (linkedPlan) usedPlanIds.add(linkedPlan.id);

      cycles.push({
        id: `smoke-${probe.jobId}`,
        kind: 'smoke',
        sortAt: linkedPlan
          ? activitySortAtLlm(linkedPlan)
          : activitySortAtProbe(probe),
        phase: normalizePhase(probe.phase),
        plan: linkedPlan,
        probe,
      });
      continue;
    }

    const plan = findPlanForProbe(probe, plans, usedPlanIds);
    if (plan) usedPlanIds.add(plan.id);
    usedProbeIds.add(probe.jobId);

    const nextPlanAt = plan ? findNextPlanAt(plans, activitySortAtLlm(plan)) : null;
    const { verify, checkpoint } = findVerifyForProbe(
      probe,
      verifyLlms,
      checkpointByLlmId,
      usedVerifyIds,
      nextPlanAt,
    );
    if (verify) {
      usedVerifyIds.add(verify.id);
      if (checkpoint) attachedCheckpointIds.add(checkpoint.id);
    }

    const verifySkipped =
      probe.status === 'failed' && !verify
        ? ('probe_failed' as const)
        : probe.status === 'done' &&
            !verify &&
            probe.exploreJobId &&
            input.terminalExploreJobs?.get(probe.exploreJobId) === 'failed'
          ? ('graph_interrupted' as const)
          : undefined;

    cycles.push({
      id: plan ? `cycle-${plan.id}-${probe.jobId}` : `cycle-probe-${probe.jobId}`,
      kind: 'incremental',
      sortAt: plan ? activitySortAtLlm(plan) : activitySortAtProbe(probe),
      phase: normalizePhase(probe.phase),
      plan,
      probe,
      verify,
      checkpoint,
      verifySkipped,
    });
  }

  for (const verify of verifyLlms) {
    if (usedVerifyIds.has(verify.id)) continue;
    const checkpoint = checkpointByLlmId.get(verify.id);
    if (checkpoint) attachedCheckpointIds.add(checkpoint.id);
    cycles.push({
      id: `verify-${verify.id}`,
      kind: 'incremental',
      sortAt: activitySortAtLlm(verify),
      phase: normalizePhase(checkpoint?.phase ?? null),
      verify,
      checkpoint,
    });
  }

  for (const plan of plans) {
    if (usedPlanIds.has(plan.id)) continue;
    const action = getPlanAction(plan);
    const kind: ExplorationCycleKind =
      action === 'scenario_complete' ? 'goal_complete' : 'plan_recovery';

    cycles.push({
      id: `plan-${plan.id}`,
      kind,
      sortAt: activitySortAtLlm(plan),
      phase: null,
      plan,
    });
  }

  const standalone: StandaloneActivity[] = [];

  for (const llm of input.llmCalls.values()) {
    if (PLAN_PURPOSES.has(llm.purpose) || llm.purpose === 'explore_verify') continue;

    if (llm.purpose === 'compile_draft') {
      standalone.push({ type: 'compile', record: llm });
      continue;
    }

    const checkpoint = checkpointByLlmId.get(llm.id);
    if (checkpoint) attachedCheckpointIds.add(checkpoint.id);
    standalone.push({ type: 'llm', llm, checkpoint });
  }

  for (const screenshot of input.screenshots.values()) {
    standalone.push({ type: 'session_capture', screenshot });
  }

  for (const checkpoint of input.checkpoints.values()) {
    if (attachedCheckpointIds.has(checkpoint.id)) continue;
    // Checkpoint may arrive over SSE before its explore_verify LLM call is in state.
    if (checkpoint.llmCallId && !input.llmCalls.has(checkpoint.llmCallId)) {
      continue;
    }
    standalone.push({ type: 'checkpoint_orphan', checkpoint });
  }

  cycles.sort((a, b) => a.sortAt - b.sortAt);
  standalone.sort((a, b) => standaloneSortAt(a) - standaloneSortAt(b));

  return { cycles, standalone };
}

function standaloneSortAt(item: StandaloneActivity): number {
  switch (item.type) {
    case 'llm':
    case 'compile':
      return activitySortAtLlm(item.type === 'compile' ? item.record : item.llm);
    case 'session_capture':
      return activitySortAtScreenshot(item.screenshot);
    case 'checkpoint_orphan':
      return activitySortAtCheckpoint(item.checkpoint);
  }
}

function standaloneTimelineId(item: StandaloneActivity): string {
  switch (item.type) {
    case 'llm':
      return `llm-${item.llm.id}`;
    case 'compile':
      return `compile-${item.record.id}`;
    case 'session_capture':
      return `screenshot-${item.screenshot.id}`;
    case 'checkpoint_orphan':
      return `checkpoint-${item.checkpoint.id}`;
  }
}

function standaloneEventAt(item: StandaloneActivity): number {
  return standaloneSortAt(item);
}

function timelinePhaseForItem(item: TimelineFeedItem): ExplorationPhase | null {
  if (item.kind === 'cycle_step') {
    return item.cycle.phase;
  }
  if (item.kind === 'standalone') {
    if (item.item.type === 'checkpoint_orphan') {
      return normalizePhase(item.item.checkpoint.phase);
    }
    if (item.item.type === 'llm' && item.item.checkpoint) {
      return normalizePhase(item.item.checkpoint.phase);
    }
  }
  return null;
}

export function expandCycleToTimelineEntries(cycle: ExplorationCycle): CycleStepFeedItem[] {
  const entries: CycleStepFeedItem[] = [];

  if (cycle.kind === 'smoke') {
    if (cycle.plan) {
      entries.push({ kind: 'cycle_step', cycle, step: 'plan' });
    }
    if (cycle.probe) {
      entries.push({ kind: 'cycle_step', cycle, step: 'probe' });
    }
    return entries;
  }

  if (cycle.kind === 'goal_complete' || cycle.kind === 'plan_recovery') {
    if (cycle.plan) {
      entries.push({ kind: 'cycle_step', cycle, step: 'plan' });
    }
    return entries;
  }

  if (cycle.plan) {
    entries.push({ kind: 'cycle_step', cycle, step: 'plan' });
  }
  if (cycle.probe) {
    entries.push({ kind: 'cycle_step', cycle, step: 'probe' });
  }
  if (cycle.verify) {
    entries.push({ kind: 'cycle_step', cycle, step: 'verify' });
  }
  if (cycle.verifySkipped) {
    entries.push({ kind: 'cycle_step', cycle, step: 'verify_skipped' });
  }

  return entries;
}

function cycleStepEventAt(cycle: ExplorationCycle, step: TimelineStepKind): number {
  switch (step) {
    case 'plan':
      return activitySortAtLlm(cycle.plan!);
    case 'probe':
      return activitySortAtProbe(cycle.probe!);
    case 'verify':
      return activitySortAtLlm(cycle.verify!);
    case 'verify_skipped':
      return activitySortAtProbe(cycle.probe!);
  }
}

export function buildTimelineFeed(
  cycles: ExplorationCycle[],
  standalone: StandaloneActivity[],
): TimelineFeedItem[] {
  type Sortable = { sortKey: ReturnType<typeof timelineSortKeyForCycleStep>; item: TimelineFeedItem };

  const sortables: Sortable[] = [
    ...cycles.flatMap((cycle) =>
      expandCycleToTimelineEntries(cycle).map((entry) => ({
        sortKey: timelineSortKeyForCycleStep(
          cycle.id,
          entry.step,
          cycleStepEventAt(cycle, entry.step),
        ),
        item: entry,
      })),
    ),
    ...standalone.map((standaloneItem) => {
      const id = standaloneTimelineId(standaloneItem);
      return {
        sortKey: timelineSortKeyForStandalone(id, standaloneEventAt(standaloneItem)),
        item: { kind: 'standalone' as const, item: standaloneItem },
      };
    }),
  ];

  sortables.sort((a, b) => compareActivityTimeline(a.sortKey, b.sortKey));

  const feed: TimelineFeedItem[] = [];
  let currentPhase: ExplorationPhase | null = null;
  let sourceDividerInserted = false;
  let followUpDividerInserted = false;

  for (const { item } of sortables) {
    const phase = timelinePhaseForItem(item);

    if (
      !followUpDividerInserted &&
      phase === 'follow_up' &&
      currentPhase === 'source'
    ) {
      feed.push({ kind: 'phase_divider', phase: 'follow_up' });
      followUpDividerInserted = true;
    }

    if (phase === 'follow_up') currentPhase = 'follow_up';
    else if (phase === 'source' && currentPhase === null) currentPhase = 'source';

    feed.push(item);

    if (
      !sourceDividerInserted &&
      item.kind === 'standalone' &&
      item.item.type === 'llm' &&
      item.item.llm.purpose === 'mr_plan'
    ) {
      feed.push({ kind: 'phase_divider', phase: 'source' });
      sourceDividerInserted = true;
      if (currentPhase === null) currentPhase = 'source';
    }
  }

  return feed;
}

/** @deprecated Use buildTimelineFeed */
export function buildCycleFeed(
  cycles: ExplorationCycle[],
  standalone: StandaloneActivity[],
): TimelineFeedItem[] {
  return buildTimelineFeed(cycles, standalone);
}

export function cycleCardIds(cycle: ExplorationCycle): string[] {
  const ids: string[] = [];
  if (cycle.plan) ids.push(`llm-${cycle.plan.id}`);
  if (cycle.probe) ids.push(`probe-${cycle.probe.jobId}`);
  if (cycle.verify) ids.push(`llm-${cycle.verify.id}`);
  if (cycle.verifySkipped) ids.push(`${cycle.id}-verify-skipped`);
  return ids;
}
