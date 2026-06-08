import type { DomainError } from '@metamorph/utils';

export class ExecutePairJobNotFoundError implements DomainError {
  readonly errorMessage: string;

  constructor(jobId: string) {
    this.errorMessage = `Execute pair job ${jobId} not found`;
  }
}

export class ExecutePairJobNotRunnableError implements DomainError {
  readonly errorMessage: string;

  constructor(jobId: string, reason: string) {
    this.errorMessage = `Execute pair job ${jobId} cannot run: ${reason}`;
  }
}

export class ExecutePairJobExecutionFailedError implements DomainError {
  readonly errorMessage: string;

  constructor(jobId: string, message: string) {
    this.errorMessage = `Execute pair job ${jobId} failed: ${message}`;
  }
}
