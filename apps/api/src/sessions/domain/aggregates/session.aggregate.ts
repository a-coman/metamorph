import {
  AggregateRoot,
  Either,
  UniqueEntityID,
  left,
  right,
} from '@metamorph/utils';
import { Job } from '../entities/job.entity.js';
import { SessionMode } from '../enums/session-mode.enum.js';
import { InvalidSessionUrlError } from '../errors/session.errors.js';
import { DiscoverJobQueuedEvent } from '../events/discover-job-queued.event.js';
import { SessionCreatedEvent } from '../events/session-created.event.js';

export type SessionProps = {
  url: string;
  mode: SessionMode;
  generateCount: number;
  weakOracle: boolean;
  jobs: Job[];
  createdAt: Date;
  updatedAt: Date;
};

export type CreateSessionInput = {
  url: string;
  mode?: SessionMode;
  generateCount?: number;
  weakOracle?: boolean;
};

export class SessionAggregate extends AggregateRoot<SessionProps> {
  private constructor(props: SessionProps, id?: UniqueEntityID) {
    super(props, id);
  }

  static create(
    input: CreateSessionInput,
  ): Either<InvalidSessionUrlError, SessionAggregate> {
    if (!isValidUrl(input.url)) {
      return left(new InvalidSessionUrlError());
    }

    const initialJob = Job.createDiscover();
    const now = new Date();
    const session = new SessionAggregate(
      {
        url: input.url,
        mode: input.mode ?? SessionMode.hitl,
        generateCount: input.generateCount ?? 1,
        weakOracle: input.weakOracle ?? false,
        jobs: [initialJob],
        createdAt: now,
        updatedAt: now,
      },
    );

    session.addDomainEvent(
      new SessionCreatedEvent(session.id.value, session.props.url),
    );
    session.addDomainEvent(
      new DiscoverJobQueuedEvent(initialJob.id.value, session.id.value),
    );

    return right(session);
  }

  static reconstitute(props: SessionProps, id: UniqueEntityID): SessionAggregate {
    return new SessionAggregate(props, id);
  }

  queueDiscover(): Job {
    const job = Job.createDiscover();
    this.props.jobs.push(job);
    this.props.updatedAt = new Date();
    this.addDomainEvent(
      new DiscoverJobQueuedEvent(job.id.value, this.id.value),
    );
    return job;
  }

  get url(): string {
    return this.props.url;
  }

  get mode(): SessionMode {
    return this.props.mode;
  }

  get generateCount(): number {
    return this.props.generateCount;
  }

  get weakOracle(): boolean {
    return this.props.weakOracle;
  }

  get jobs(): Job[] {
    return this.props.jobs;
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }

  get updatedAt(): Date {
    return this.props.updatedAt;
  }
}

function isValidUrl(value: string): boolean {
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}
