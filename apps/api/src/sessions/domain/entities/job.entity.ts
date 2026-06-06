import {
  Entity,
  Either,
  UniqueEntityID,
  left,
  right,
  type DomainError,
} from '@metamorph/utils';
import { InvalidJobStatusTransitionError } from '../errors/session.errors.js';
import { JobStatus } from '../enums/job-status.enum.js';
import { JobType } from '../enums/job-type.enum.js';

export type JobProps = {
  type: JobType;
  status: JobStatus;
  errorMessage?: string | null;
  createdAt: Date;
  startedAt?: Date | null;
  finishedAt?: Date | null;
};

export class Job extends Entity<JobProps> {
  private constructor(props: JobProps, id?: UniqueEntityID) {
    super(props, id);
  }

  static createDiscover(): Job {
    return new Job({
      type: JobType.discover,
      status: JobStatus.pending_enqueue,
      createdAt: new Date(),
    });
  }

  static reconstitute(props: JobProps, id: UniqueEntityID): Job {
    return new Job(props, id);
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

  get createdAt(): Date {
    return this.props.createdAt;
  }

  get startedAt(): Date | null | undefined {
    return this.props.startedAt;
  }

  get finishedAt(): Date | null | undefined {
    return this.props.finishedAt;
  }

  markEnqueued(): Either<DomainError, void> {
    if (this.props.status !== JobStatus.pending_enqueue) {
      return left(
        new InvalidJobStatusTransitionError(
          this.id.value,
          this.props.status,
          'mark enqueued',
        ),
      );
    }

    this.props.status = JobStatus.queued;
    this.props.errorMessage = null;
    return right(undefined);
  }

  markEnqueueFailed(message: string): Either<DomainError, void> {
    if (this.props.status !== JobStatus.pending_enqueue) {
      return left(
        new InvalidJobStatusTransitionError(
          this.id.value,
          this.props.status,
          'mark enqueue failed',
        ),
      );
    }

    this.props.status = JobStatus.enqueue_failed;
    this.props.errorMessage = message;
    return right(undefined);
  }
}
