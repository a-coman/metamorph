import { resolveVerifyVerdict } from '@/components/llm-response-panel';
import type {
  ExplorationCheckpointDto,
  LlmCallDto,
  ProbeStatusDto,
} from '@metamorph/api-client';

export type TerminalExploreJobStatus = 'done' | 'failed';

export type ActivityStatusContext = {
  terminalExploreJobs?: Map<string, TerminalExploreJobStatus>;
  sessionControlStatus?: 'active' | 'pausing' | 'paused';
};

function isSessionPaused(ctx?: ActivityStatusContext): boolean {
  const status = ctx?.sessionControlStatus;
  return status === 'paused' || status === 'pausing';
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function isExploreJobTerminal(
  jobId: string | null | undefined,
  ctx?: ActivityStatusContext,
): boolean {
  if (!jobId || !ctx?.terminalExploreJobs) return false;
  return ctx.terminalExploreJobs.has(jobId);
}

export function resolveLlmCallStatus(
  llmCall: LlmCallDto,
  checkpoint?: ExplorationCheckpointDto,
  ctx?: ActivityStatusContext,
): string {
  if (
    llmCall.status === 'running' &&
    isExploreJobTerminal(llmCall.jobId, ctx)
  ) {
    return 'stale';
  }
  if (llmCall.status === 'running') {
    return isSessionPaused(ctx) ? 'paused' : 'running';
  }
  if (llmCall.status === 'failed') return 'failed';

  const response = asRecord(llmCall.responseJson);
  const purpose = llmCall.purpose;

  if (purpose === 'explore_plan' || purpose === 'plan_explore') {
    const action = response?.action;
    if (typeof action === 'string') return action;
  }

  if (purpose === 'explore_verify') {
    const verdict = resolveVerifyVerdict(llmCall.responseJson, checkpoint) ?? 'ok';
    if (verdict === 'ok') return 'pass';
    return verdict;
  }

  if (purpose === 'mr_plan') {
    return 'done';
  }

  if (purpose === 'observation_anchor') {
    return 'done';
  }

  if (purpose === 'compile_draft') {
    return 'pass';
  }

  return 'pass';
}

export function resolveProbeBadgeStatus(
  probe: ProbeStatusDto,
  ctx?: ActivityStatusContext,
): string {
  if (
    (probe.status === 'queued' || probe.status === 'running') &&
    isExploreJobTerminal(probe.exploreJobId, ctx)
  ) {
    return 'stale';
  }
  if (probe.status === 'done') return 'pass';
  if (probe.status === 'failed') return 'failed';
  if (probe.status === 'queued' || probe.status === 'running') {
    return isSessionPaused(ctx) ? 'paused' : 'running';
  }
  return probe.status;
}
