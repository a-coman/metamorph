import { Injectable, MessageEvent, NotFoundException } from '@nestjs/common';
import type { SessionEvent } from '@metamorph/api-client';
import { MrVersionStatus } from '../../../../generated/prisma/enums.js';
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
                createdAt: true,
                startedAt: true,
                finishedAt: true,
                errorMessage: true,
              },
              orderBy: { createdAt: 'desc' },
            },
            mrVersions: {
              select: { id: true, status: true },
              orderBy: { createdAt: 'desc' },
            },
          },
        });

        if (!session) {
          subscriber.error(
            new NotFoundException(`Session ${sessionId} not found`),
          );
          return null;
        }

        const events: SessionEvent[] = [];
        const jobState = new Map<string, string>();
        const mrState = new Map<string, string>();

        for (const job of session.jobs) {
          const key = `${job.type}:${job.status}`;
          jobState.set(job.id, key);

          if (initialized) {
            const previous = lastJobState.get(job.id);
            if (previous !== key) {
              events.push({ type: 'job.updated', job });
            }
          }
        }

        for (const mr of session.mrVersions) {
          mrState.set(mr.id, mr.status);

          if (initialized) {
            const previous = lastMrStatus.get(mr.id);
            if (previous !== mr.status) {
              events.push({
                type: 'mr.status_changed',
                mrVersionId: mr.id,
                status: mr.status,
              });
            }
          }
        }

        lastJobState = jobState;
        lastMrStatus = mrState;
        initialized = true;

        const latestMr = session.mrVersions[0];
        const terminal =
          latestMr !== undefined && MR_TERMINAL_STATUSES.has(latestMr.status);

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
