import { resolveVerifyVerdict } from '@/components/llm-response-panel';
import type {
  ExplorationCheckpointDto,
  LlmCallDto,
  ProbeStatusDto,
} from '@metamorph/api-client';

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

export function resolveLlmCallStatus(
  llmCall: LlmCallDto,
  checkpoint?: ExplorationCheckpointDto,
): string {
  if (llmCall.status === 'running') return 'running';
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

  if (purpose === 'compile_draft') {
    return 'pass';
  }

  return 'pass';
}

export function resolveProbeBadgeStatus(probe: ProbeStatusDto): string {
  if (probe.status === 'done') return 'pass';
  if (probe.status === 'failed') return 'failed';
  if (probe.status === 'queued' || probe.status === 'running') return 'running';
  return probe.status;
}
