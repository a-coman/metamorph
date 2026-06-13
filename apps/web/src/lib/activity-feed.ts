import type {
  ExplorationCheckpointDto,
  LlmCallDto,
  ProbeStatusDto,
  ScreenshotDto,
} from '@metamorph/api-client';

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

/** Display timestamp for activity card headers (may reflect completion). */
export function activityDisplayAtProbe(probe: ProbeStatusDto): Date {
  return new Date(probe.updatedAt);
}

export function activityDisplayAtLlm(llm: LlmCallDto): Date {
  return new Date(llm.updatedAt ?? llm.createdAt);
}
