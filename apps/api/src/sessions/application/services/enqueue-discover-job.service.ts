import { Injectable } from '@nestjs/common';
import type { DomainError, Either } from '@metamorph/utils';
import { left, right } from '@metamorph/utils';
import { JobStatus } from '../../domain/enums/job-status.enum.js';
import { SessionNotFoundError } from '../../domain/errors/session.errors.js';
import { SessionRepositoryPort } from '../../domain/repositories/session.repository.port.js';
import { JobMessagePublisherPort } from '../ports/job-message-publisher.port.js';

export type EnqueueDiscoverJobResult = {
  status: JobStatus;
};

@Injectable()
export class EnqueueDiscoverJobService {
  constructor(
    private readonly sessionRepository: SessionRepositoryPort,
    private readonly jobMessagePublisher: JobMessagePublisherPort,
  ) {}

  async enqueue(
    jobId: string,
    sessionId: string,
  ): Promise<Either<DomainError, EnqueueDiscoverJobResult>> {
    const aggregate = await this.sessionRepository.findById(sessionId);
    if (!aggregate) {
      return left(new SessionNotFoundError(sessionId));
    }

    const markEnqueued = aggregate.markJobEnqueued(jobId);
    if (markEnqueued.isLeft()) {
      return left(markEnqueued.value);
    }

    await this.sessionRepository.save(aggregate);

    try {
      await this.jobMessagePublisher.publishDiscoverJob({
        jobId,
        sessionId,
        url: aggregate.url,
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Failed to publish discover job';

      const markFailed = aggregate.markJobEnqueueFailed(jobId, message);
      if (markFailed.isLeft()) {
        return left(markFailed.value);
      }

      await this.sessionRepository.save(aggregate);

      return right({ status: JobStatus.enqueue_failed });
    }

    return right({ status: JobStatus.queued });
  }
}
