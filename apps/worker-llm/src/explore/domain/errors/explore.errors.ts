import type { DomainError } from '@metamorph/utils';

export class JobNotFoundError implements DomainError {
  readonly errorMessage: string;

  constructor(jobId: string) {
    this.errorMessage = `Explore job ${jobId} not found`;
  }
}

export class JobNotRunnableError implements DomainError {
  readonly errorMessage: string;

  constructor(jobId: string, reason: string) {
    this.errorMessage = `Explore job ${jobId} not runnable: ${reason}`;
  }
}

export class JobExecutionFailedError implements DomainError {
  readonly errorMessage: string;

  constructor(jobId: string, message: string) {
    this.errorMessage = `Explore job ${jobId} failed: ${message}`;
  }
}
