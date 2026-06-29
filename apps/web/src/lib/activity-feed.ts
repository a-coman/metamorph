import type {
  ExplorationCheckpointDto,
  LlmCallDto,
  ProbeStatusDto,
  ScreenshotDto,
} from '@metamorph/api-client';

export type TimelineStepKind = 'plan' | 'probe' | 'verify' | 'verify_skipped';

export const TIMELINE_STEP_RANK: Record<TimelineStepKind, number> = {
  plan: 0,
  probe: 1,
  verify: 2,
  verify_skipped: 3,
};

export const TIMELINE_STANDALONE_RANK = 4;

export type TimelineSortKey = {
  eventAt: number;
  stepRank: number;
  id: string;
};

export function activitySortAtLlm(llm: LlmCallDto): number {
  return new Date(llm.createdAt).getTime();
}

export function activitySortAtProbe(probe: ProbeStatusDto): number {
  return new Date(probe.createdAt).getTime();
}

export function activitySortAtScreenshot(screenshot: ScreenshotDto): number {
  return new Date(screenshot.createdAt).getTime();
}

export function activitySortAtCheckpoint(checkpoint: ExplorationCheckpointDto): number {
  return new Date(checkpoint.createdAt).getTime();
}

/** Unified timeline timestamp for sort and display (always createdAt). */
export function activityEventAtLlm(llm: LlmCallDto): Date {
  return new Date(llm.createdAt);
}

export function activityEventAtProbe(probe: ProbeStatusDto): Date {
  return new Date(probe.createdAt);
}

export function activityEventAtScreenshot(screenshot: ScreenshotDto): Date {
  return new Date(screenshot.createdAt);
}

export function activityEventAtCheckpoint(checkpoint: ExplorationCheckpointDto): Date {
  return new Date(checkpoint.createdAt);
}

export function timelineSortKeyForCycleStep(
  cycleId: string,
  step: TimelineStepKind,
  eventAt: number,
): TimelineSortKey {
  return {
    eventAt,
    stepRank: TIMELINE_STEP_RANK[step],
    id: `${cycleId}:${step}`,
  };
}

export function timelineSortKeyForStandalone(id: string, eventAt: number): TimelineSortKey {
  return {
    eventAt,
    stepRank: TIMELINE_STANDALONE_RANK,
    id,
  };
}

export function compareActivityTimeline(a: TimelineSortKey, b: TimelineSortKey): number {
  if (a.eventAt !== b.eventAt) {
    return a.eventAt - b.eventAt;
  }
  if (a.stepRank !== b.stepRank) {
    return a.stepRank - b.stepRank;
  }
  return a.id.localeCompare(b.id);
}
