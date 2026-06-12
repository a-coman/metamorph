import { Injectable, MessageEvent, NotFoundException } from '@nestjs/common';
import type { MrVersionEvent } from '@metamorph/api-client';
import { MrVersionStatus, RunStatus } from '../../../../generated/prisma/enums.js';
import { PrismaService } from '../../../shared/infrastructure/prisma/prisma.service.js';
import { TracePathQuery } from '../../infrastructure/trace-path.query.js';
import { Observable } from 'rxjs';

const STREAM_TIMEOUT_MS = 30 * 60 * 1000;
const POLL_INTERVAL_MS = 1000;

function isStreamTerminal(
  status: MrVersionStatus,
  latestRunStatus: RunStatus | null,
): boolean {
  if (
    status === MrVersionStatus.draft_pending_hitl ||
    status === MrVersionStatus.exploration_failed
  ) {
    return true;
  }

  if (status === MrVersionStatus.approved && latestRunStatus !== null) {
    return (
      latestRunStatus === RunStatus.completed ||
      latestRunStatus === RunStatus.failed
    );
  }

  return false;
}

@Injectable()
export class MrVersionEventsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tracePathQuery: TracePathQuery,
  ) {}

  stream(mrVersionId: string): Observable<MessageEvent> {
    return new Observable((subscriber) => {
      const startedAt = Date.now();
      let lastStatus: string | null = null;
      let seenCheckpointIds = new Set<string>();
      let lastRunState = new Map<string, string>();
      let initialized = false;

      const poll = async () => {
        const mrVersion = await this.prisma.mrVersion.findUnique({
          where: { id: mrVersionId },
          select: {
            status: true,
            runs: {
              select: {
                id: true,
                status: true,
                verdictStrict: true,
                attempt: true,
                createdAt: true,
                finishedAt: true,
              },
              orderBy: { createdAt: 'desc' },
            },
            explorationCheckpoints: {
              select: {
                id: true,
                phase: true,
                sequence: true,
                snapshotId: true,
                stepsJson: true,
                verdict: true,
                rationale: true,
                llmCallId: true,
                createdAt: true,
              },
              orderBy: { sequence: 'asc' },
            },
          },
        });

        if (!mrVersion) {
          subscriber.error(
            new NotFoundException(`MR version ${mrVersionId} not found`),
          );
          return null;
        }

        type TimestampedEvent = { event: MrVersionEvent; timestamp: Date };
        const timestampedEvents: TimestampedEvent[] = [];
        const runState = new Map<string, string>();

        if (initialized && lastStatus !== mrVersion.status) {
          timestampedEvents.push({
            event: { type: 'status.changed', status: mrVersion.status },
            timestamp: new Date(),
          });
        }
        lastStatus = mrVersion.status;

        const snapshotIdsForTrace: string[] = [];
        for (const checkpoint of mrVersion.explorationCheckpoints) {
          if (!seenCheckpointIds.has(checkpoint.id)) {
            snapshotIdsForTrace.push(checkpoint.snapshotId);
          }
        }

        const traceInfoMap = snapshotIdsForTrace.length > 0
          ? await this.tracePathQuery.resolveBySnapshotIds(snapshotIdsForTrace)
          : new Map();

        for (const checkpoint of mrVersion.explorationCheckpoints) {
          if (!seenCheckpointIds.has(checkpoint.id)) {
            const traceInfo = traceInfoMap.get(checkpoint.snapshotId);
            timestampedEvents.push({
              event: {
                type: 'checkpoint.created',
                checkpoint: {
                  ...checkpoint,
                  llmCallId: checkpoint.llmCallId ?? null,
                  tracePath: traceInfo?.path ?? null,
                  traceArtifactId: traceInfo?.artifactId ?? null,
                },
              },
              timestamp: checkpoint.createdAt,
            });
            seenCheckpointIds.add(checkpoint.id);
          }
        }

        for (const run of mrVersion.runs) {
          const key = `${run.status}:${run.verdictStrict ?? ''}`;
          runState.set(run.id, key);

          if (initialized) {
            const previous = lastRunState.get(run.id);
            if (previous !== key) {
              timestampedEvents.push({
                event: { type: 'run.updated', run },
                timestamp: run.createdAt,
              });
            }
          }
        }
        lastRunState = runState;
        initialized = true;

        timestampedEvents.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
        const events = timestampedEvents.map((te) => te.event);

        const latestRun = mrVersion.runs[0];
        const terminal = isStreamTerminal(
          mrVersion.status,
          latestRun?.status ?? null,
        );

        return { events, terminal };
      };

      const handlePollResult = (result: { events: MrVersionEvent[]; terminal: boolean } | null) => {
        if (!result) {
          return true;
        }

        for (const event of result.events) {
          subscriber.next({ data: event });
        }

        if (result.terminal || Date.now() - startedAt >= STREAM_TIMEOUT_MS) {
          subscriber.next({ data: { type: 'stream.end' } });
          subscriber.complete();
          return true;
        }
        return false;
      };

      let timer: ReturnType<typeof setInterval> | undefined;

      void poll()
        .then((result) => {
          const done = handlePollResult(result);
          if (!done) {
            timer = setInterval(() => {
              void poll()
                .then(handlePollResult)
                .catch((error: unknown) => {
                  subscriber.error(error);
                  if (timer) clearInterval(timer);
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
}
