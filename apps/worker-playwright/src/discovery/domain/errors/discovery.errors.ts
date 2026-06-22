import type { DomainError } from '@metamorph/utils';

export class JobNotFoundError implements DomainError {
  readonly errorMessage: string;

  constructor(jobId: string) {
    this.errorMessage = `Job ${jobId} not found`;
  }
}

export class JobNotRunnableError implements DomainError {
  readonly errorMessage: string;

  constructor(jobId: string, reason: string) {
    this.errorMessage = `Job ${jobId} cannot run: ${reason}`;
  }
}

export class JobExecutionFailedError implements DomainError {
  readonly errorMessage: string;

  constructor(jobId: string, message: string) {
    this.errorMessage = `Job ${jobId} failed: ${message}`;
  }
}

export class JobPausedError implements DomainError {
  readonly errorMessage: string;

  constructor(jobId: string) {
    this.errorMessage = `Job ${jobId} paused`;
  }
}
