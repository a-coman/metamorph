import type { MrDefinition, ObservableDef } from '@metamorph/core';
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
import { ExecutePairJobNotRunnableError } from '../errors/execute-pair.errors.js';

export type ExecutePairJobProps = {
  sessionId: string;
  sessionUrl: string;
  runId: string;
  mrVersionId: string;
  type: JobType;
  status: JobStatus;
  playbookContent: string;
  schemaContent: string;
  mrDefinition: MrDefinition;
  observables: ObservableDef[];
  playbookContentHash: string;
  errorMessage?: string | null;
  startedAt?: Date | null;
  finishedAt?: Date | null;
};

export class ExecutePairJob extends Entity<ExecutePairJobProps> {
  private constructor(props: ExecutePairJobProps, id: UniqueEntityID) {
    super(props, id);
  }

  static reconstitute(
    props: ExecutePairJobProps,
    id: UniqueEntityID,
  ): ExecutePairJob {
    return new ExecutePairJob(props, id);
  }

  get sessionId(): string {
    return this.props.sessionId;
  }

  get sessionUrl(): string {
    return this.props.sessionUrl;
  }

  get runId(): string {
    return this.props.runId;
  }

  get mrVersionId(): string {
    return this.props.mrVersionId;
  }

  get type(): JobType {
    return this.props.type;
  }

  get status(): JobStatus {
    return this.props.status;
  }

  get playbookContent(): string {
    return this.props.playbookContent;
  }

  get schemaContent(): string {
    return this.props.schemaContent;
  }

  get mrDefinition(): MrDefinition {
    return this.props.mrDefinition;
  }

  get observables(): ObservableDef[] {
    return this.props.observables;
  }

  get playbookContentHash(): string {
    return this.props.playbookContentHash;
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
    if (this.props.type !== JobType.execute_pair) {
      return left(
        new ExecutePairJobNotRunnableError(this.id.value, `type=${this.props.type}`),
      );
    }

    if (this.props.status !== JobStatus.queued) {
      return left(
        new ExecutePairJobNotRunnableError(
          this.id.value,
          `status=${this.props.status}`,
        ),
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
