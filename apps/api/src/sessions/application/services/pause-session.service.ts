import { Injectable } from '@nestjs/common';
import type { DomainError, Either } from '@metamorph/utils';
import { left, right } from '@metamorph/utils';
import {
  JobStatus,
  JobType,
  RunStatus,
  SessionControlStatus,
} from '../../../../generated/prisma/enums.js';
import { PrismaService } from '../../../shared/infrastructure/prisma/prisma.service.js';
import {
  SessionNotFoundError,
  SessionNotPausableError,
} from '../../domain/errors/session.errors.js';

const ACTIVE_JOB_STATUSES: JobStatus[] = [
  JobStatus.pending_enqueue,
  JobStatus.queued,
  JobStatus.running,
];

const ACTIVE_RUN_STATUSES: RunStatus[] = [RunStatus.pending, RunStatus.running];

export type PauseSessionResult = {
  controlStatus: SessionControlStatus;
};

@Injectable()
export class PauseSessionService {
  constructor(private readonly prisma: PrismaService) {}

  async pause(sessionId: string): Promise<Either<DomainError, PauseSessionResult>> {
    const session = await this.prisma.session.findUnique({
      where: { id: sessionId },
      select: {
        id: true,
        controlStatus: true,
        jobs: {
          where: {
            OR: [
              { status: { in: ACTIVE_JOB_STATUSES } },
              {
                status: JobStatus.running,
                runs: { some: { status: { in: ACTIVE_RUN_STATUSES } } },
              },
            ],
          },
          select: { id: true },
          take: 1,
        },
        mrVersions: {
          where: { status: 'exploring' },
          select: { id: true },
          take: 1,
        },
      },
    });

    if (!session) {
      return left(new SessionNotFoundError(sessionId));
    }

    if (session.controlStatus !== SessionControlStatus.active) {
      return left(
        new SessionNotPausableError(
          sessionId,
          `control status is ${session.controlStatus}`,
        ),
      );
    }

    const hasInterruptibleWork =
      session.jobs.length > 0 || session.mrVersions.length > 0;

    if (!hasInterruptibleWork) {
      return left(
        new SessionNotPausableError(sessionId, 'no active work to pause'),
      );
    }

    const updated = await this.prisma.session.update({
      where: { id: sessionId },
      data: {
        controlStatus: SessionControlStatus.pausing,
        controlStatusChangedAt: new Date(),
      },
      select: { controlStatus: true },
    });

    return right({ controlStatus: updated.controlStatus });
  }
}
