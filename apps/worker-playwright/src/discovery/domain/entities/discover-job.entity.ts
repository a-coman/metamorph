import {
  Entity,
  Either,
  UniqueEntityID,
  left,
  right,
  type DomainError,
} from '@metamorph/utils';
import { JobStatus } from '../enums/job-status.enum.js';
import { JobType } from '../enums/job-type.enum.js';
import { JobNotRunnableError } from '../errors/discovery.errors.js';

export type DiscoverJobProps = {
  sessionId: string;
  sessionUrl: string;
  type: JobType;
  status: JobStatus;
  errorMessage?: string | null;
  startedAt?: Date | null;
  finishedAt?: Date | null;
};

export class DiscoverJob extends Entity<DiscoverJobProps> {
  private constructor(props: DiscoverJobProps, id: UniqueEntityID) {
    super(props, id);
  }

  static reconstitute(props: DiscoverJobProps, id: UniqueEntityID): DiscoverJob {
    return new DiscoverJob(props, id);
  }

  get sessionId(): string {
    return this.props.sessionId;
  }

  get sessionUrl(): string {
    return this.props.sessionUrl;
  }

  get type(): JobType {
    return this.props.type;
  }

  get status(): JobStatus {
    return this.props.status;
  }

  get errorMessage(): string | null | undefined {
    return this.props.errorMessage;
  }

  get startedAt(): Date | null | undefined {
    return this.props.startedAt;
  }

  get finishedAt(): Date | null | undefined {
    return this.props.finishedAt;
  }

  start(): Either<DomainError, void> {
    if (this.props.type !== JobType.discover) {
      return left(
        new JobNotRunnableError(this.id.value, `type=${this.props.type}`),
      );
    }

    if (this.props.status !== JobStatus.queued) {
      return left(
        new JobNotRunnableError(this.id.value, `status=${this.props.status}`),
      );
    }

    this.props.status = JobStatus.running;
    this.props.startedAt = new Date();
    this.props.errorMessage = null;
    return right(undefined);
  }

  complete(): void {
    this.props.status = JobStatus.done;
    this.props.finishedAt = new Date();
  }

  fail(message: string): void {
    this.props.status = JobStatus.failed;
    this.props.finishedAt = new Date();
    this.props.errorMessage = message;
  }

  pause(): void {
    this.props.status = JobStatus.paused;
    this.props.finishedAt = new Date();
  }
}
