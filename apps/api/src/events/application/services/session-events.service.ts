import { Injectable, MessageEvent, NotFoundException } from '@nestjs/common';
import type { SessionEvent, LlmCallDto, ProbeStatusDto, ScreenshotDto } from '@metamorph/api-client';
import { MrVersionStatus, JobType, JobStatus } from '../../../../generated/prisma/enums.js';
import { PrismaService } from '../../../shared/infrastructure/prisma/prisma.service.js';
import { Observable } from 'rxjs';

const STREAM_TIMEOUT_MS = 30 * 60 * 1000;
const POLL_INTERVAL_MS = 1000;

const MR_TERMINAL_STATUSES = new Set<string>([
  MrVersionStatus.draft_pending_hitl,
  MrVersionStatus.exploration_failed,
  MrVersionStatus.approved,
  MrVersionStatus.replayable,
  MrVersionStatus.stale,
  MrVersionStatus.violation_pending_triage,
]);

const TERMINAL_JOB_STATUSES = new Set<JobStatus>([
  JobStatus.done,
  JobStatus.failed,
  JobStatus.enqueue_failed,
]);

type ProbeJobPayload = {
  phase?: string;
  mode?: 'incremental' | 'smoke_replay';
  validated_prefix?: unknown[];
  probe_steps?: unknown[];
  explore_job_id?: string;
  plan_llm_call_id?: string;
  cycle_iteration?: number;
};

function resolveProbeMode(
  payload: Record<string, unknown> | null,
): ProbeStatusDto['mode'] {
  const mode = (payload as ProbeJobPayload | null)?.mode;
  return mode === 'smoke_replay' ? 'smoke_replay' : 'incremental';
}

function resolveProbeExecutedSteps(
  payload: Record<string, unknown> | null,
): unknown[] {
  const typed = payload as ProbeJobPayload | null;
  const prefix = Array.isArray(typed?.validated_prefix) ? typed.validated_prefix : [];
  const batch = Array.isArray(typed?.probe_steps) ? typed.probe_steps : [];
  return [...prefix, ...batch];
}

@Injectable()
export class SessionEventsService {
  constructor(private readonly prisma: PrismaService) {}

  stream(sessionId: string): Observable<MessageEvent> {
    return new Observable((subscriber) => {
      const startedAt = Date.now();
      let lastJobState = new Map<string, string>();
      let lastMrStatus = new Map<string, string>();
      let lastLlmState = new Map<string, string>();
      let lastProbeState = new Map<string, string>();
      let seenScreenshotIds = new Set<string>();
      let seenMrIds = new Set<string>();
      let initialized = false;

      const poll = async () => {
        const session = await this.prisma.session.findUnique({
          where: { id: sessionId },
          select: {
            jobs: {
              select: {
                id: true,
                type: true,
                status: true,
                payload: true,
                createdAt: true,
                startedAt: true,
                finishedAt: true,
                errorMessage: true,
                llmCalls: {
                  select: {
                    id: true,
                    jobId: true,
                    purpose: true,
                    model: true,
                    promptVersion: true,
                    tokensIn: true,
                    tokensOut: true,
                    latencyMs: true,
                    responseJson: true,
                    createdAt: true,
                    completedAt: true,
                    updatedAt: true,
                  },
                  orderBy: { createdAt: 'asc' },
                },
              },
              orderBy: { createdAt: 'asc' },
            },
            mrVersions: {
              select: {
                id: true,
                status: true,
                createdAt: true,
                mrDefinition: {
                  select: { transformFamily: true },
                },
              },
              orderBy: { createdAt: 'desc' },
            },
            pageSnapshots: {
              select: {
                id: true,
                jobId: true,
                url: true,
                createdAt: true,
                annotatedScreenshotId: true,
                rawScreenshotId: true,
              },
              orderBy: { createdAt: 'asc' },
              take: 20,
            },
          },
        });

        if (!session) {
          subscriber.error(
            new NotFoundException(`Session ${sessionId} not found`),
          );
          return null;
        }

        type TimestampedEvent = { event: SessionEvent; timestamp: Date };
        const timestampedEvents: TimestampedEvent[] = [];
        const isInitialPoll = !initialized;
        const jobState = new Map<string, string>();
        const mrState = new Map<string, string>();
        const probeState = new Map<string, string>();
        const llmState = new Map<string, string>();
        const probeJobIds = new Set(
          session.jobs
            .filter((job) => job.type === JobType.probe)
            .map((job) => job.id),
        );
        const snapshotByJobId = new Map(
          session.pageSnapshots
            .filter((snapshot) => snapshot.jobId !== null)
            .map((snapshot) => [snapshot.jobId as string, snapshot]),
        );

        for (const job of session.jobs) {
          const key = `${job.type}:${job.status}`;
          jobState.set(job.id, key);

          const previous = lastJobState.get(job.id);
          const isNewOrChanged = previous !== key;
          
          if (initialized && isNewOrChanged) {
            timestampedEvents.push({
              event: { type: 'job.updated', job },
              timestamp: job.startedAt ?? job.createdAt,
            });
          } else if (
            isInitialPoll &&
            job.type === JobType.explore &&
            TERMINAL_JOB_STATUSES.has(job.status)
          ) {
            timestampedEvents.push({
              event: { type: 'job.updated', job },
              timestamp: job.finishedAt ?? job.startedAt ?? job.createdAt,
            });
          }

          if (job.type === JobType.probe) {
            const probeKey = `${job.status}:${job.errorMessage ?? ''}`;
            probeState.set(job.id, probeKey);

            const prevProbe = lastProbeState.get(job.id);
            if (prevProbe !== probeKey) {
              const payload = job.payload as Record<string, unknown> | null;
              const executedSteps = resolveProbeExecutedSteps(payload);
              const outputSnapshot = snapshotByJobId.get(job.id);
              const outputSnapshotId = outputSnapshot?.id ?? null;
              const probeUpdatedAt = job.finishedAt ?? job.startedAt ?? job.createdAt;
              const probe: ProbeStatusDto = {
                jobId: job.id,
                exploreJobId: (payload?.explore_job_id as string) ?? null,
                planLlmCallId: (payload?.plan_llm_call_id as string) ?? null,
                cycleIteration:
                  typeof payload?.cycle_iteration === 'number'
                    ? payload.cycle_iteration
                    : null,
                status: this.mapJobStatus(job.status),
                mode: resolveProbeMode(payload),
                phase: (payload?.phase as string) ?? null,
                stepCount: executedSteps.length > 0 ? executedSteps.length : null,
                executedSteps: executedSteps.length > 0 ? executedSteps : null,
                error: job.errorMessage,
                snapshotId: outputSnapshotId,
                outputSnapshotId,
                createdAt: job.createdAt,
                startedAt: job.startedAt,
                updatedAt: probeUpdatedAt,
              };
              timestampedEvents.push({
                event: { type: 'probe.status', probe },
                timestamp: job.createdAt,
              });
            }
          }

          for (const llmCall of job.llmCalls) {
            const llmKey = this.llmStateKey(llmCall);
            llmState.set(llmCall.id, llmKey);
            const prevLlm = lastLlmState.get(llmCall.id);
            if (prevLlm !== llmKey) {
              const llmCallDto = this.mapLlmCallDto(llmCall);
              timestampedEvents.push({
                event: { type: 'llm.status', llmCall: llmCallDto },
                timestamp: llmCallDto.updatedAt,
              });
            }
          }
        }

        for (const mr of session.mrVersions) {
          mrState.set(mr.id, mr.status);

          if (!seenMrIds.has(mr.id)) {
            timestampedEvents.push({
              event: {
                type: 'mr.created',
                mr: {
                  id: mr.id,
                  status: mr.status,
                  transformFamily: mr.mrDefinition.transformFamily,
                },
              },
              timestamp: mr.createdAt,
            });
            seenMrIds.add(mr.id);
          } else if (initialized) {
            const previous = lastMrStatus.get(mr.id);
            if (previous !== mr.status) {
              timestampedEvents.push({
                event: {
                  type: 'mr.status_changed',
                  mrVersionId: mr.id,
                  status: mr.status,
                },
                timestamp: new Date(),
              });
            }
          }
        }

        for (const snapshot of session.pageSnapshots) {
          if (!seenScreenshotIds.has(snapshot.id)) {
            const artifactId = snapshot.annotatedScreenshotId ?? snapshot.rawScreenshotId;
            const isProbeOutput =
              snapshot.jobId !== null && probeJobIds.has(snapshot.jobId);
            if (artifactId && !isProbeOutput) {
              const screenshot: ScreenshotDto = {
                id: snapshot.id,
                snapshotId: snapshot.id,
                jobId: snapshot.jobId,
                artifactId,
                url: snapshot.url,
                createdAt: snapshot.createdAt,
              };
              timestampedEvents.push({
                event: { type: 'screenshot.captured', screenshot },
                timestamp: snapshot.createdAt,
              });
            }
            seenScreenshotIds.add(snapshot.id);
          }
        }

        timestampedEvents.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
        const events = timestampedEvents.map((te) => te.event);

        lastJobState = jobState;
        lastMrStatus = mrState;
        lastProbeState = probeState;
        lastLlmState = llmState;
        initialized = true;

        const latestMr = session.mrVersions[0];
        const terminal =
          latestMr !== undefined && MR_TERMINAL_STATUSES.has(latestMr.status);

        return { events, terminal };
      };

      const handlePollResult = (result: { events: SessionEvent[]; terminal: boolean } | null) => {
        if (!result) {
          clearInterval(timer);
          return true;
        }

        for (const event of result.events) {
          subscriber.next({ data: event });
        }

        if (
          result.terminal ||
          Date.now() - startedAt >= STREAM_TIMEOUT_MS
        ) {
          subscriber.next({ data: { type: 'stream.end' } });
          subscriber.complete();
          clearInterval(timer);
          return true;
        }
        return false;
      };

      let timer: ReturnType<typeof setInterval>;

      void poll()
        .then((result) => {
          const done = handlePollResult(result);
          if (!done) {
            timer = setInterval(() => {
              void poll()
                .then(handlePollResult)
                .catch((error: unknown) => {
                  subscriber.error(error);
                  clearInterval(timer);
                });
            }, POLL_INTERVAL_MS);
          }
        })
        .catch((error: unknown) => {
          subscriber.error(error);
        });

      return () => {
        if (timer) clearInterval(timer);
      };
    });
  }

  private llmStateKey(llmCall: {
    responseJson: unknown;
    tokensIn: number | null;
    tokensOut: number | null;
    latencyMs: number | null;
  }): string {
    return [
      this.mapLlmCallStatus(llmCall.responseJson),
      llmCall.tokensIn,
      llmCall.tokensOut,
      llmCall.latencyMs,
      llmCall.responseJson === null ? 'null' : 'set',
    ].join(':');
  }

  private mapLlmCallStatus(responseJson: unknown): LlmCallDto['status'] {
    if (responseJson === null || responseJson === undefined) {
      return 'running';
    }

    if (
      typeof responseJson === 'object' &&
      responseJson !== null &&
      'error' in responseJson &&
      typeof (responseJson as { error?: unknown }).error === 'string'
    ) {
      return 'failed';
    }

    return 'done';
  }

  private mapLlmCallDto(llmCall: {
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
    const status = this.mapLlmCallStatus(llmCall.responseJson);

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

  private mapJobStatus(status: JobStatus): ProbeStatusDto['status'] {
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
}
