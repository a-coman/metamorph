import { Injectable } from '@nestjs/common';
import {
  type DomainError,
  type Either,
  left,
  right,
} from '@metamorph/utils';
import { SessionAggregate } from '../../domain/aggregates/session.aggregate.js';
import { SessionNotFoundError } from '../../domain/errors/session.errors.js';
import { DiscoverJobQueuedEvent } from '../../domain/events/discover-job-queued.event.js';
import { SessionRepositoryPort } from '../../domain/repositories/session.repository.port.js';
import type {
  CreateSessionDto,
  CreateSessionResultDto,
  QueueDiscoverResultDto,
} from '../dtos/create-session.dto.js';
import type { SessionDetailsDto } from '../dtos/session-details.dto.js';
import { SessionPort } from '../ports/session.port.js';
import { SessionQueryPort } from '../ports/session-query.port.js';
import { EnqueueDiscoverJobService } from './enqueue-discover-job.service.js';

@Injectable()
export class SessionService implements SessionPort {
  constructor(
    private readonly sessionRepository: SessionRepositoryPort,
    private readonly sessionQuery: SessionQueryPort,
    private readonly enqueueDiscoverJobService: EnqueueDiscoverJobService,
  ) {}

  async createSession(
    dto: CreateSessionDto,
  ): Promise<Either<DomainError, CreateSessionResultDto>> {
    const aggregateOrError = SessionAggregate.create(dto);
    if (aggregateOrError.isLeft()) {
      return left(aggregateOrError.value);
    }

    const aggregate = aggregateOrError.value;
    await this.sessionRepository.save(aggregate);

    const jobStatus = await this.processDiscoverJobQueuedEvents(aggregate);
    const job = aggregate.jobs[0];
    if (!job) {
      throw new Error('Session aggregate must include an initial discover job');
    }

    return right({
      sessionId: aggregate.id.value,
      jobId: job.id.value,
      status: jobStatus ?? job.status,
    });
  }

  async queueDiscover(
    sessionId: string,
  ): Promise<Either<DomainError, QueueDiscoverResultDto>> {
    const aggregate = await this.sessionRepository.findById(sessionId);
    if (!aggregate) {
      return left(new SessionNotFoundError(sessionId));
    }

    const job = aggregate.queueDiscover();
    await this.sessionRepository.save(aggregate);

    const jobStatus = await this.processDiscoverJobQueuedEvents(aggregate);

    return right({
      jobId: job.id.value,
      status: jobStatus ?? job.status,
    });
  }

  async getSession(
    sessionId: string,
  ): Promise<Either<DomainError, SessionDetailsDto>> {
    const details = await this.sessionQuery.findDetailsById(sessionId);
    if (!details) {
      return left(new SessionNotFoundError(sessionId));
    }

    return right(details);
  }

  private async processDiscoverJobQueuedEvents(
    aggregate: SessionAggregate,
  ): Promise<string | undefined> {
    const events = aggregate.pullDomainEvents();
    let lastStatus: string | undefined;

    for (const event of events) {
      if (event instanceof DiscoverJobQueuedEvent) {
        const result = await this.enqueueDiscoverJobService.enqueue(
          event.jobId,
          event.sessionId,
        );

        if (result.isLeft()) {
          throw new Error(result.value.errorMessage ?? 'Enqueue discover failed');
        }

        lastStatus = result.value.status;
      }
    }

    return lastStatus;
  }
}
