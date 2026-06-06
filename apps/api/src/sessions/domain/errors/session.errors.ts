import type { DomainError } from '@metamorph/utils';

export class SessionNotFoundError implements DomainError {
  readonly errorMessage: string;

  constructor(sessionId: string) {
    this.errorMessage = `Session ${sessionId} not found`;
  }
}

export class InvalidSessionUrlError implements DomainError {
  readonly errorMessage = 'Invalid session URL';
}

export class JobNotFoundInSessionError implements DomainError {
  readonly errorMessage: string;

  constructor(jobId: string) {
    this.errorMessage = `Job ${jobId} not found in session`;
  }
}

export class InvalidJobStatusTransitionError implements DomainError {
  readonly errorMessage: string;

  constructor(jobId: string, from: string, action: string) {
    this.errorMessage = `Job ${jobId} cannot ${action} from status ${from}`;
  }
}
