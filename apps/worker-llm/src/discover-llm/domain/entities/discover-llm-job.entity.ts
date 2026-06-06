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
import { JobNotRunnableError } from '../errors/discover-llm.errors.js';

export type DiscoverLlmJobProps = {
  sessionId: string;
  sessionUrl: string;
  pageSnapshotId: string;
  type: JobType;
  status: JobStatus;
  errorMessage?: string | null;
  startedAt?: Date | null;
  finishedAt?: Date | null;
};

export class DiscoverLlmJob extends Entity<DiscoverLlmJobProps> {
  private constructor(props: DiscoverLlmJobProps, id: UniqueEntityID) {
    super(props, id);
  }

  static reconstitute(
    props: DiscoverLlmJobProps,
    id: UniqueEntityID,
  ): DiscoverLlmJob {
    return new DiscoverLlmJob(props, id);
  }

  get sessionId(): string {
    return this.props.sessionId;
  }

  get sessionUrl(): string {
    return this.props.sessionUrl;
  }

  get pageSnapshotId(): string {
    return this.props.pageSnapshotId;
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
    if (this.props.type !== JobType.discover_llm) {
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
}
