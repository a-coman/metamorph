import type { DomainError } from '@metamorph/utils';

export class ProbeJobNotFoundError implements DomainError {
  readonly errorMessage: string;

  constructor(jobId: string) {
    this.errorMessage = `Probe job ${jobId} not found`;
  }
}

export class ProbeJobNotRunnableError implements DomainError {
  readonly errorMessage: string;

  constructor(jobId: string, reason: string) {
    this.errorMessage = `Probe job ${jobId} not runnable: ${reason}`;
  }
}

export class ProbeJobExecutionFailedError implements DomainError {
  readonly errorMessage: string;

  constructor(jobId: string, message: string) {
    this.errorMessage = `Probe job ${jobId} failed: ${message}`;
  }
}
