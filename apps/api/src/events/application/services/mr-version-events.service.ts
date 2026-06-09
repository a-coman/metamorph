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
      let lastCheckpointId: string | null = null;
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

        const events: MrVersionEvent[] = [];
        const runState = new Map<string, string>();

        if (initialized && lastStatus !== mrVersion.status) {
          events.push({
            type: 'status.changed',
            status: mrVersion.status,
          });
        }
        lastStatus = mrVersion.status;

        const latestCheckpoint =
          mrVersion.explorationCheckpoints.at(-1) ?? null;
        if (
          initialized &&
          latestCheckpoint &&
          latestCheckpoint.id !== lastCheckpointId
        ) {
          const tracePaths = await this.tracePathQuery.resolveBySnapshotIds([
            latestCheckpoint.snapshotId,
          ]);

          events.push({
            type: 'checkpoint.created',
            checkpoint: {
              ...latestCheckpoint,
              tracePath:
                tracePaths.get(latestCheckpoint.snapshotId) ?? null,
            },
          });
        }
        lastCheckpointId = latestCheckpoint?.id ?? null;

        for (const run of mrVersion.runs) {
          const key = `${run.status}:${run.verdictStrict ?? ''}`;
          runState.set(run.id, key);

          if (initialized) {
            const previous = lastRunState.get(run.id);
            if (previous !== key) {
              events.push({
                type: 'run.updated',
                run,
              });
            }
          }
        }
        lastRunState = runState;
        initialized = true;

        const latestRun = mrVersion.runs[0];
        const terminal = isStreamTerminal(
          mrVersion.status,
          latestRun?.status ?? null,
        );

        return { events, terminal };
      };

      const timer = setInterval(() => {
        void poll()
          .then((result) => {
            if (!result) {
              clearInterval(timer);
              return;
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
            }
          })
          .catch((error: unknown) => {
            subscriber.error(error);
            clearInterval(timer);
          });
      }, POLL_INTERVAL_MS);

      void poll().catch((error: unknown) => {
        subscriber.error(error);
        clearInterval(timer);
      });

      return () => clearInterval(timer);
    });
  }
}
