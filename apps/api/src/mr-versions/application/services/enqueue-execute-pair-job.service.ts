import { Injectable } from '@nestjs/common';
import { JobMessagePublisherPort } from '../../../sessions/application/ports/job-message-publisher.port.js';
import {
  JobStatus,
  JobType,
} from '../../../../generated/prisma/enums.js';
import { PrismaService } from '../../../shared/infrastructure/prisma/prisma.service.js';

export type EnqueueExecutePairInput = {
  jobId: string;
  sessionId: string;
  mrVersionId: string;
  runId: string;
  url: string;
};

@Injectable()
export class EnqueueExecutePairJobService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jobMessagePublisher: JobMessagePublisherPort,
  ) {}

  async enqueue(input: EnqueueExecutePairInput): Promise<{ status: JobStatus }> {
    await this.prisma.job.update({
      where: { id: input.jobId },
      data: { status: JobStatus.queued },
    });

    try {
      await this.jobMessagePublisher.publishExecutePairJob({
        jobId: input.jobId,
        sessionId: input.sessionId,
        mrVersionId: input.mrVersionId,
        runId: input.runId,
        url: input.url,
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Failed to publish execute pair job';

      await this.prisma.job.update({
        where: { id: input.jobId },
        data: {
          status: JobStatus.enqueue_failed,
          errorMessage: message,
        },
      });

      return { status: JobStatus.enqueue_failed };
    }

    return { status: JobStatus.queued };
  }
}
