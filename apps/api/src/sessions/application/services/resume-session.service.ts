import { Injectable } from '@nestjs/common';
import type { DomainError, Either } from '@metamorph/utils';
import { left, right } from '@metamorph/utils';
import {
  JobStatus,
  JobType,
  SessionControlStatus,
} from '../../../../generated/prisma/enums.js';
import { PrismaService } from '../../../shared/infrastructure/prisma/prisma.service.js';
import {
  SessionNotFoundError,
  SessionNotResumableError,
} from '../../domain/errors/session.errors.js';
import { JobMessagePublisherPort } from '../ports/job-message-publisher.port.js';

export type ResumeSessionResult = {
  controlStatus: SessionControlStatus;
  jobId: string;
  jobType: JobType;
};

@Injectable()
export class ResumeSessionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jobMessagePublisher: JobMessagePublisherPort,
  ) {}

  async resume(sessionId: string): Promise<Either<DomainError, ResumeSessionResult>> {
    const session = await this.prisma.session.findUnique({
      where: { id: sessionId },
      select: {
        id: true,
        url: true,
        controlStatus: true,
        jobs: {
          where: { status: JobStatus.paused },
          orderBy: { updatedAt: 'desc' },
          take: 1,
          select: {
            id: true,
            type: true,
            mrVersionId: true,
            payload: true,
            startedAt: true,
            runs: {
              select: { id: true },
              take: 1,
              orderBy: { createdAt: 'desc' },
            },
          },
        },
      },
    });

    if (!session) {
      return left(new SessionNotFoundError(sessionId));
    }

    if (session.controlStatus !== SessionControlStatus.paused) {
      return left(
        new SessionNotResumableError(
          sessionId,
          `control status is ${session.controlStatus}`,
        ),
      );
    }

    const pausedJob = session.jobs[0];
    if (!pausedJob) {
      return left(
        new SessionNotResumableError(sessionId, 'no paused job found'),
      );
    }

    const resumeJobStatus =
      pausedJob.type === JobType.explore && pausedJob.startedAt
        ? JobStatus.running
        : JobStatus.queued;

    await this.prisma.session.update({
      where: { id: sessionId },
      data: {
        controlStatus: SessionControlStatus.active,
        controlStatusChangedAt: new Date(),
      },
    });

    await this.prisma.job.update({
      where: { id: pausedJob.id },
      data: {
        status: resumeJobStatus,
        finishedAt: null,
        errorMessage: null,
      },
    });

    try {
      await this.publishPausedJob(session, pausedJob);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Failed to republish paused job';

      await this.prisma.job.update({
        where: { id: pausedJob.id },
        data: {
          status: JobStatus.enqueue_failed,
          errorMessage: message,
        },
      });

      return left(new SessionNotResumableError(sessionId, message));
    }

    return right({
      controlStatus: SessionControlStatus.active,
      jobId: pausedJob.id,
      jobType: pausedJob.type,
    });
  }

  private async publishPausedJob(
    session: { id: string; url: string },
    job: {
      id: string;
      type: JobType;
      mrVersionId: string | null;
      payload: unknown;
      startedAt: Date | null;
      runs: { id: string }[];
    },
  ): Promise<void> {
    switch (job.type) {
      case JobType.discover:
        await this.jobMessagePublisher.publishDiscoverJob({
          jobId: job.id,
          sessionId: session.id,
          url: session.url,
        });
        return;

      case JobType.explore:
        if (job.startedAt) {
          await this.jobMessagePublisher.publishExploreUserResume({
            jobId: job.id,
            sessionId: session.id,
            exploreJobId: job.id,
          });
        } else {
          const payload = job.payload as { page_snapshot_id?: string };
          if (!payload.page_snapshot_id) {
            throw new Error('Explore job missing page_snapshot_id');
          }
          await this.jobMessagePublisher.publishExploreJob({
            jobId: job.id,
            sessionId: session.id,
            pageSnapshotId: payload.page_snapshot_id,
            url: session.url,
          });
        }
        return;

      case JobType.probe: {
        if (!job.mrVersionId) {
          throw new Error('Probe job missing mrVersionId');
        }
        await this.jobMessagePublisher.publishProbeJob({
          jobId: job.id,
          sessionId: session.id,
          mrVersionId: job.mrVersionId,
          payload: job.payload as Record<string, unknown>,
        });
        return;
      }

      case JobType.execute_pair: {
        const runId = job.runs[0]?.id;
        if (!job.mrVersionId || !runId) {
          throw new Error('Execute pair job missing mrVersionId or run');
        }
        await this.jobMessagePublisher.publishExecutePairJob({
          jobId: job.id,
          sessionId: session.id,
          mrVersionId: job.mrVersionId,
          runId,
          url: session.url,
        });
        return;
      }

      default:
        throw new Error(`Cannot resume job type ${job.type}`);
    }
  }
}
