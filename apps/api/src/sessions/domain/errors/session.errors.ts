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
