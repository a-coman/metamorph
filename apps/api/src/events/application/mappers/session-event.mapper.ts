import type { LlmCallDto, ProbeStatusDto, ScreenshotDto } from '@metamorph/api-client';
import { JobStatus } from '../../../../generated/prisma/enums.js';

export type ProbeJobPayload = {
  phase?: string;
  mode?: 'incremental' | 'smoke_replay';
  validated_prefix?: unknown[];
  probe_steps?: unknown[];
  explore_job_id?: string;
  plan_llm_call_id?: string;
  cycle_iteration?: number;
};

export function resolveProbeMode(
  payload: Record<string, unknown> | null,
): ProbeStatusDto['mode'] {
  const mode = (payload as ProbeJobPayload | null)?.mode;
  return mode === 'smoke_replay' ? 'smoke_replay' : 'incremental';
}

export function resolveProbeExecutedSteps(
  payload: Record<string, unknown> | null,
): unknown[] {
  const typed = payload as ProbeJobPayload | null;
  const prefix = Array.isArray(typed?.validated_prefix) ? typed.validated_prefix : [];
  const batch = Array.isArray(typed?.probe_steps) ? typed.probe_steps : [];
  return [...prefix, ...batch];
}

export function mapLlmCallStatus(responseJson: unknown): LlmCallDto['status'] {
  if (responseJson === null || responseJson === undefined) {
    return 'running';
  }

  if (typeof responseJson === 'object' && responseJson !== null) {
    const record = responseJson as { error?: unknown; action?: unknown };
    if (record.action === 'plan_rejected') {
      return 'done';
    }
    if (typeof record.error === 'string') {
      return 'failed';
    }
  }

  return 'done';
}

export function mapLlmCallDto(llmCall: {
  id: string;
  jobId: string | null;
  purpose: string;
  model: string;
  promptVersion: string;
  tokensIn: number | null;
  tokensOut: number | null;
  latencyMs: number | null;
  responseJson: unknown;
  createdAt: Date;
  completedAt: Date | null;
  updatedAt: Date;
}): LlmCallDto {
  const status = mapLlmCallStatus(llmCall.responseJson);

  return {
    id: llmCall.id,
    jobId: llmCall.jobId,
    purpose: llmCall.purpose,
    model: llmCall.model,
    promptVersion: llmCall.promptVersion,
    status,
    tokensIn: llmCall.tokensIn,
    tokensOut: llmCall.tokensOut,
    latencyMs: llmCall.latencyMs,
    responseJson: llmCall.responseJson ?? null,
    createdAt: llmCall.createdAt,
    updatedAt: llmCall.completedAt ?? llmCall.updatedAt ?? llmCall.createdAt,
  };
}

export function mapProbeJobStatus(status: JobStatus): ProbeStatusDto['status'] {
  switch (status) {
    case JobStatus.queued:
    case JobStatus.pending_enqueue:
      return 'queued';
    case JobStatus.running:
      return 'running';
    case JobStatus.done:
      return 'done';
    case JobStatus.failed:
    case JobStatus.enqueue_failed:
      return 'failed';
    default:
      return 'queued';
  }
}

export function mapProbeDto(input: {
  job: {
    id: string;
    status: JobStatus;
    payload: unknown;
    createdAt: Date;
    startedAt: Date | null;
    finishedAt: Date | null;
    errorMessage: string | null;
  };
  outputSnapshotId: string | null;
}): ProbeStatusDto {
  const payload = input.job.payload as Record<string, unknown> | null;
  const executedSteps = resolveProbeExecutedSteps(payload);
  const probeUpdatedAt = input.job.finishedAt ?? input.job.startedAt ?? input.job.createdAt;

  return {
    jobId: input.job.id,
    exploreJobId: (payload?.explore_job_id as string) ?? null,
    planLlmCallId: (payload?.plan_llm_call_id as string) ?? null,
    cycleIteration:
      typeof payload?.cycle_iteration === 'number' ? payload.cycle_iteration : null,
    status: mapProbeJobStatus(input.job.status),
    mode: resolveProbeMode(payload),
    phase: (payload?.phase as string) ?? null,
    stepCount: executedSteps.length > 0 ? executedSteps.length : null,
    executedSteps: executedSteps.length > 0 ? executedSteps : null,
    error: input.job.errorMessage,
    snapshotId: input.outputSnapshotId,
    outputSnapshotId: input.outputSnapshotId,
    createdAt: input.job.createdAt,
    startedAt: input.job.startedAt,
    updatedAt: probeUpdatedAt,
  };
}

export function mapScreenshotDto(input: {
  id: string;
  jobId: string | null;
  url: string;
  createdAt: Date;
  annotatedScreenshotId: string | null;
  rawScreenshotId: string | null;
}): ScreenshotDto | null {
  const artifactId = input.annotatedScreenshotId ?? input.rawScreenshotId;
  if (!artifactId) {
    return null;
  }

  return {
    id: input.id,
    snapshotId: input.id,
    jobId: input.jobId,
    artifactId,
    url: input.url,
    createdAt: input.createdAt,
  };
}
