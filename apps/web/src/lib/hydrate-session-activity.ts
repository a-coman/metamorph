import type {
  ExplorationCheckpointDto,
  LlmCallDto,
  ProbeStatusDto,
  ScreenshotDto,
  SessionActivityDto,
} from '@metamorph/api-client';
import type { TerminalExploreJobStatus } from '@/lib/activity-status';

export type HydratedActivityState = {
  llmCalls: Map<string, LlmCallDto>;
  probes: Map<string, ProbeStatusDto>;
  screenshots: Map<string, ScreenshotDto>;
  checkpoints: Map<string, ExplorationCheckpointDto>;
  terminalExploreJobs: Map<string, TerminalExploreJobStatus>;
};

function normalizeLlmCall(llmCall: LlmCallDto): LlmCallDto {
  return {
    ...llmCall,
    jobId: llmCall.jobId ?? null,
    status:
      llmCall.status ??
      (llmCall.responseJson !== null && llmCall.responseJson !== undefined ? 'done' : 'running'),
    updatedAt: llmCall.updatedAt ?? llmCall.createdAt,
  };
}

function normalizeProbe(probe: ProbeStatusDto): ProbeStatusDto {
  const createdAt = probe.createdAt ?? probe.updatedAt;
  return {
    ...probe,
    exploreJobId: probe.exploreJobId ?? null,
    planLlmCallId: probe.planLlmCallId ?? null,
    cycleIteration: probe.cycleIteration ?? null,
    createdAt,
    startedAt: probe.startedAt ?? null,
    updatedAt: probe.updatedAt ?? createdAt,
  };
}

export function hydrateSessionActivity(
  activity: SessionActivityDto,
): HydratedActivityState {
  const llmCalls = new Map<string, LlmCallDto>();
  for (const llmCall of activity.llmCalls) {
    llmCalls.set(llmCall.id, normalizeLlmCall(llmCall));
  }

  const probes = new Map<string, ProbeStatusDto>();
  for (const probe of activity.probes) {
    probes.set(probe.jobId, normalizeProbe(probe));
  }

  const screenshots = new Map<string, ScreenshotDto>();
  for (const screenshot of activity.screenshots) {
    screenshots.set(screenshot.id, screenshot);
  }

  const checkpoints = new Map<string, ExplorationCheckpointDto>();
  for (const checkpoint of activity.checkpoints) {
    checkpoints.set(checkpoint.id, checkpoint);
  }

  const terminalExploreJobs = new Map<string, TerminalExploreJobStatus>(
    Object.entries(activity.terminalExploreJobs),
  );

  return {
    llmCalls,
    probes,
    screenshots,
    checkpoints,
    terminalExploreJobs,
  };
}
