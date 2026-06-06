import { Entity, UniqueEntityID } from '@metamorph/utils';
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
      status: JobStatus.queued,
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
}
