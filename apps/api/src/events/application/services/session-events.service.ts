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

@Injectable()
export class SessionEventsService {
  constructor(private readonly prisma: PrismaService) {}

  stream(sessionId: string): Observable<MessageEvent> {
    return new Observable((subscriber) => {
      const startedAt = Date.now();
      let lastJobState = new Map<string, string>();
      let lastMrStatus = new Map<string, string>();
      let seenLlmCallIds = new Set<string>();
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
                    purpose: true,
                    model: true,
                    promptVersion: true,
                    tokensIn: true,
                    tokensOut: true,
                    latencyMs: true,
                    createdAt: true,
                  },
                  orderBy: { createdAt: 'asc' },
                  take: 20,
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
        const jobState = new Map<string, string>();
        const mrState = new Map<string, string>();
        const probeState = new Map<string, string>();

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
          }

          if (job.type === JobType.probe) {
            const probeKey = `${job.status}:${job.errorMessage ?? ''}`;
            probeState.set(job.id, probeKey);

            const prevProbe = lastProbeState.get(job.id);
            if (prevProbe !== probeKey) {
              const payload = job.payload as Record<string, unknown> | null;
              const probeUpdatedAt = job.finishedAt ?? job.startedAt ?? job.createdAt;
              const probe: ProbeStatusDto = {
                jobId: job.id,
                status: this.mapJobStatus(job.status),
                phase: (payload?.phase as string) ?? null,
                stepCount: Array.isArray(payload?.probeSteps) ? payload.probeSteps.length : null,
                error: job.errorMessage,
                snapshotId: null,
                updatedAt: probeUpdatedAt,
              };
              timestampedEvents.push({
                event: { type: 'probe.status', probe },
                timestamp: probeUpdatedAt,
              });
            }
          }

          for (const llmCall of job.llmCalls) {
            if (!seenLlmCallIds.has(llmCall.id)) {
              const llmCallDto: LlmCallDto = {
                id: llmCall.id,
                purpose: llmCall.purpose,
                model: llmCall.model,
                promptVersion: llmCall.promptVersion,
                tokensIn: llmCall.tokensIn,
                tokensOut: llmCall.tokensOut,
                latencyMs: llmCall.latencyMs,
                createdAt: llmCall.createdAt,
              };
              timestampedEvents.push({
                event: { type: 'llm.call', llmCall: llmCallDto },
                timestamp: llmCall.createdAt,
              });
              seenLlmCallIds.add(llmCall.id);
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
            if (artifactId) {
              const screenshot: ScreenshotDto = {
                id: snapshot.id,
                snapshotId: snapshot.id,
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
